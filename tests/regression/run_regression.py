#!/usr/bin/env python3
"""
Visual Regression Test Runner
Compares two pipeline modes across 9 test cases (3 rooms × 3 styles).
Optionally runs an AI evaluation pass (Claude API) to produce suggested scores.
Generates a self-contained interactive HTML scoring report.

Usage:
    python run_regression.py                         # run tests + AI eval + report
    python run_regression.py --skip-ai               # run tests, skip AI eval
    python run_regression.py --report-only <run_dir> # regenerate report from manifest
    python run_regression.py --eval-only  <run_dir>  # re-run AI eval on existing outputs
"""

import base64
import json
import os
import subprocess
import sys
import time
from datetime import datetime

# Ensure UTF-8 output on Windows regardless of terminal code page
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
from pathlib import Path

import requests
import yaml
from dotenv import load_dotenv
from runtime_config import (
    BENCHMARK_MODE_MATRIX,
    COMPARISON_ASSUMPTIONS,
    SEMANTIC_ROLES,
    ROOT,
    TESTS_DIR,
    resolve_api_base,
    resolve_backend_cmd,
    resolve_health_url,
    resolve_service_dir,
)

# ── paths ─────────────────────────────────────────────────────────────────────

FIXTURES    = ROOT / "fixtures"
OUTPUTS     = ROOT / "runs"
CONFIG_FILE = Path(os.environ["REGRESSION_CONFIG"]) if os.environ.get("REGRESSION_CONFIG") else TESTS_DIR / "config.yaml"
SERVICE_DIR = resolve_service_dir()

# Load environment variables from project root
load_dotenv(ROOT / ".env", override=True)

# ── config ────────────────────────────────────────────────────────────────────

def load_config():
    with open(CONFIG_FILE) as f:
        return yaml.safe_load(f)

# ── backend ───────────────────────────────────────────────────────────────────

def backend_alive(base):
    try:
        return requests.get(resolve_health_url(base), timeout=2).status_code == 200
    except Exception:
        return False

def start_backend(base):
    if backend_alive(base):
        print("Backend already running.")
        return None
    print("Starting backend...")
    cmd = resolve_backend_cmd()
    proc = subprocess.Popen(
        cmd,
        cwd=SERVICE_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=False,
    )
    for _ in range(30):
        time.sleep(2)
        if backend_alive(base):
            print("Backend ready.")
            return proc
    proc.terminate()
    raise RuntimeError("Backend failed to start within 60s.")

# ── generation api ────────────────────────────────────────────────────────────

def call_pipeline(base, fixture_path, room_type, style, pipeline_mode, style_influence, extra_fields=None):
    ext  = fixture_path.suffix.lower()
    mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    with open(fixture_path, "rb") as img:
        files = {"roomImage": (fixture_path.name, img, mime)}
        data  = {
            "roomType":       room_type,
            "stylePreset":    json.dumps({"id": style["id"], "name": style["name"]}),
            "styleInfluence": str(style_influence),
            "isRefinement":   "false",
            "textPrompt":     "",
        }
        if extra_fields:
            data.update({k: str(v) for k, v in extra_fields.items()})
        resp = requests.post(
            f"{base}/generate-visualization?mode={pipeline_mode}",
            files=files,
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

# ── generation runner ─────────────────────────────────────────────────────────

def run_tests(cfg):
    base      = resolve_api_base(cfg.get("api_base"))
    rooms     = cfg["rooms"]
    styles    = cfg["styles"]
    pipes     = cfg["pipelines"]
    influence = cfg.get("style_influence", 50)

    run_id  = datetime.now().strftime("run_%Y%m%d_%H%M%S")
    run_dir = OUTPUTS / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "run_id":    run_id,
        "timestamp": datetime.now().isoformat(),
        "pipelines": pipes,
        "cases":     [],
    }

    total = len(rooms) * len(styles)
    n     = 0

    for room in rooms:
        fixture = FIXTURES / room["fixture"]
        if not fixture.exists():
            print(f"  MISSING FIXTURE: {fixture} — skipping {room['label']}")
            continue

        for style in styles:
            n += 1
            case_id = f"{room['id']}_{style['id']}"
            print(f"\n[{n}/{total}] {room['label']} + {style['name']} ({style['bucket']})")

            case = {
                "case_id":      case_id,
                "room":         room["label"],
                "room_type":    room["room_type"],
                "style":        style["name"],
                "bucket":       style["bucket"],
                "fixture":      room["fixture"],
                "results":      {},
                "ai_evaluation": None,
            }

            for pipe in pipes:
                slug = pipe["slug"]
                out  = run_dir / f"{case_id}_{slug}.png"
                dbg  = run_dir / f"{case_id}_{slug}_debug.json"

                print(f"  → {pipe['label']}...", end="", flush=True)
                try:
                    r = call_pipeline(base, fixture, room["room_type"], style, pipe["mode"], influence, extra_fields=cfg.get("request_fields"))
                    out.write_bytes(base64.b64decode(r["data"]["image"]))
                    dbg.write_text(json.dumps(r["data"].get("debug", {}), indent=2))
                    case["results"][slug] = {
                        "image":  out.name,
                        "debug":  r["data"].get("debug", {}),
                        "status": "ok",
                    }
                    print(" ✓")
                except Exception as e:
                    case["results"][slug] = {"status": "error", "error": str(e)}
                    print(f" ✗  {e}")

            manifest["cases"].append(case)

    (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nOutputs saved → {run_dir}")
    return run_dir, manifest

# ── ai evaluation ─────────────────────────────────────────────────────────────

BUCKET_DESCRIPTIONS = {
    "LOW":    "sparse and restrained — minimal objects, no grouped decor, deliberate negative space",
    "MEDIUM": "balanced and intentional — moderate presence, clear focal point, no clutter",
    "HIGH":   "layered and expressive — rich material identity, composed groupings, warm atmosphere",
}

EVAL_METRICS = [
    "structural_fidelity",
    "window_exterior_preservation",
    "style_fidelity",
    "material_hierarchy",
    "staging_density",
    "functional_realism",
    "design_fidelity",
    "defects_artifacts",
]

HARD_REJECTION_RULES = [
    "New wall, door, or window added",
    "Window removed, replaced by wall/object, or window count changed",
    "Window geometry significantly altered (moved, resized, or blocked by opaque surface)",
    "Exterior view removed or replaced by an interior object",
    "Major camera or perspective shift",
    "Impossible geometry",
    "Severe rendering artifact",
    "Floating or unsupported objects",
    "Visible cables, cords, or clutter that should be removed",
    "Corrupted or incomplete image",
]

EVAL_PROMPT = """\
You are evaluating AI-generated interior design visualizations for a production regression test.

You will see three images in order:
  Image 1 — INPUT: the original room photo (the fixed architectural reference)
  Image 2 — BASELINE: output from the baseline pipeline
  Image 3 — NEWEST BUILD: output from the newest build pipeline

Context:
  Style: {style_name}
  Staging bucket: {bucket} ({bucket_description})
  Room type: {room_type}
  Newest build debug metadata:
{debug_excerpt}

Score each output (BASELINE and NEWEST BUILD) independently on a 1–5 integer scale:

  structural_fidelity          — fixed architectural geometry unchanged: walls, floor, ceiling,
                                 windows, doors, room proportions, camera angle, perspective
                                 5=identical architecture, 3=minor drift, 1=major structural changes
                                 EXCLUDE from this score: mirrors, vanities, sinks, tubs, fixtures,
                                 furniture, and all movable or replaceable objects — these are
                                 expected to change in a redesign and must NOT affect this metric
  window_exterior_preservation — windows and exterior view structurally preserved
                                 5=window present, geometry intact, exterior view visible or logically implied
                                 3=minor structural drift but window and view largely intact
                                 1=window removed/replaced/blocked, or exterior view eliminated
                                 NOTE: curtains, drapes, sheers, blinds, valances, or other soft window
                                 treatments added by the style are ACCEPTABLE and must NOT lower this score
                                 unless they fully obscure a view that was unobstructed in the source image.
                                 Score only on whether the window itself and the exterior view are preserved.
  style_fidelity               — how clearly the target style is expressed
                                 5=unmistakable style, 3=diluted or generic, 1=wrong or collapsed
  material_hierarchy           — material contrast and intentionality
                                 5=clear hierarchy, 3=acceptable but flat, 1=monochrome or incoherent
  staging_density              — appropriate density for the staging bucket
                                 5=correct for bucket, 3=slightly off, 1=wrong density (empty or cluttered)
  functional_realism           — logical, usable object placement
                                 5=fully functional, 3=minor issues, 1=unusable or illogical
  design_fidelity              — design intent, lighting quality, spatial depth
                                 5=strong intent and depth, 3=clean but flat, 1=featureless or confused
  defects_artifacts            — rendering quality and absence of artifacts
                                 5=no defects, 3=minor issues, 1=severe artifacts or corruption

Hard rejection — list any rules that apply to each output (empty list if none):
  "New wall, door, or window added"
  "Window removed, replaced by wall/object, or window count changed"
  "Window geometry significantly altered (moved, resized, or blocked by opaque surface)"
  "Exterior view removed or replaced by an interior object"
  "Major camera or perspective shift"
  "Impossible geometry"
  "Severe rendering artifact"
  "Floating or unsupported objects"
  "Visible cables, cords, or clutter that should be removed"
  "Corrupted or incomplete image"

IMPORTANT — window treatment clarification:
  Adding curtains, drapes, sheers, blinds, valances, or any soft fabric window treatment is NOT
  a hard rejection and must NOT trigger any window-related rule. These are style-driven choices.
  Only flag a window rule if the window opening itself is structurally altered, removed, or the
  exterior view is materially eliminated by an opaque surface or replaced by an interior object.

Winner logic:
  - If one output has a hard rejection and the other does not → non-failing output wins
  - If both fail → "Neither"
  - If neither fails → compare weighted scores (weights: structural=20%, window=15%, style=15%, material=15%, staging=10%, functional=10%, design=10%, defects=5%)
  - Window treatments (curtains, drapes, sheers, blinds) added by the style are never a hard rejection
  - If weighted score difference ≤ 0.25 → "Tie / subjective"
  - Otherwise → higher score wins

Return ONLY valid JSON — no markdown, no explanation outside the JSON object:
{{
  "baseline": {{
    "structural_fidelity": <int 1-5>,
    "window_exterior_preservation": <int 1-5>,
    "style_fidelity": <int 1-5>,
    "material_hierarchy": <int 1-5>,
    "staging_density": <int 1-5>,
    "functional_realism": <int 1-5>,
    "design_fidelity": <int 1-5>,
    "defects_artifacts": <int 1-5>,
    "hard_rejections": [<strings from the list above, or empty>]
  }},
  "newest_build": {{
    "structural_fidelity": <int 1-5>,
    "window_exterior_preservation": <int 1-5>,
    "style_fidelity": <int 1-5>,
    "material_hierarchy": <int 1-5>,
    "staging_density": <int 1-5>,
    "functional_realism": <int 1-5>,
    "design_fidelity": <int 1-5>,
    "defects_artifacts": <int 1-5>,
    "hard_rejections": [<strings from the list above, or empty>]
  }},
  "winner": "<Baseline|Newest Build|Tie / subjective|Neither>",
  "rationale": "<one sentence explaining the winner decision>",
  "key_regression": "<one sentence describing the most significant regression in newest build, or null>",
  "key_improvement": "<one sentence describing the most significant improvement in newest build, or null>",
  "prompt_config_note": "<observation from debug metadata relevant to the result, or null>"
}}"""

# ── validity classifier ────────────────────────────────────────────────────────

VALIDITY_VIOLATIONS = {
    "corrupted_or_incomplete_image",
    "window_opening_removed",
    "window_opening_blocked_by_opaque_non_fabric_surface",
    "new_structural_element_added",
    "room_type_changed",
    "fundamentally_different_camera_position",
}

VALIDITY_CLASSIFIER_PROMPT = """\
You are a visual validity classifier for AI-generated interior design images.

Compare the SOURCE image (Image 1) to the GENERATED output (Image 2).
Determine whether the generated output has any hard structural validity failures.

Step 1 — window check:
  Examine the SOURCE image. If NO windows or openings are visible in the source,
  skip rules "window_opening_removed" and "window_opening_blocked_by_opaque_non_fabric_surface" entirely.

Step 2 — evaluate each rule independently:

  corrupted_or_incomplete_image
    The output is blank, severely corrupted, cut off, or visually unusable.

  window_opening_removed
    A visible source window or opening was removed or replaced by a wall, artwork,
    shelving, mirror, cabinetry, or another solid non-window element.
    Apply ONLY if the source has visible windows. Mutually exclusive with the rule below.

  window_opening_blocked_by_opaque_non_fabric_surface
    A visible source window still exists spatially but is blocked by an opaque solid
    non-fabric element that effectively eliminates the window as a light or view source.
    Apply ONLY if the source has visible windows. Mutually exclusive with the rule above.
    NOT applicable to: curtains, drapes, blinds, sheers, shades, or any fabric or soft treatment.
    If the source already had frosted glass, blinds, or an obscured view, preserving that is NOT a failure.

  new_structural_element_added
    A new permanent structural element was added that did not exist in the source.
    Applies to: new walls, new doors, new permanent window openings (including when source has no visible windows),
    new load-bearing columns, and new permanent ceiling geometry members (exposed beams, coffer grids, plank systems, dropped soffits, skylight framing).
    Does NOT apply to: shiplap, brick veneer, wall paneling, decorative panels, shoji screens,
    surface cladding, material changes, furniture, portable decor, or lighting fixtures.

  room_type_changed
    The generated output transforms the room into a different functional room type.
    Examples: bedroom becomes a living room, bathroom becomes a kitchen, kitchen becomes a dining room.

  fundamentally_different_camera_position
    The apparent camera position is fundamentally different from the source.
    Apply ONLY for clear binary cases: a different wall becomes the primary viewpoint,
    the camera appears to have moved to the opposite side of the room, or the view direction
    is fundamentally changed.
    Do NOT apply for: minor crop drift, minor lens differences, small perspective shifts,
    or slightly different framing.

Step 3 — "window_opening_removed" and "window_opening_blocked_by_opaque_non_fabric_surface"
  are mutually exclusive. Apply at most one per output, never both.

Return ONLY valid JSON — no markdown, no explanation outside the JSON:
{
  "verdict": "PASS" or "FAIL",
  "violations": [],
  "rationale": "One sentence explaining the verdict."
}

- verdict must be exactly "PASS" or "FAIL"
- if verdict is "PASS", violations must be []
- if verdict is "FAIL", violations must contain at least one value from the allowed enum
- use only the exact enum strings listed above — no paraphrasing\
"""


def load_image_b64(path):
    with open(path, "rb") as f:
        data = f.read()
    ext  = Path(path).suffix.lower()
    mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    return base64.standard_b64encode(data).decode("utf-8"), mime


def weighted_ai_score(scores, weights):
    total = sum(scores.get(k, 0) * v for k, v in weights.items())
    return round(total, 2)


def _validate_classifier_result(raw_result):
    """Validate classifier JSON output. Returns a normalised validity dict."""
    verdict    = raw_result.get("verdict")
    violations = raw_result.get("violations") or []
    rationale  = str(raw_result.get("rationale") or "")

    if verdict not in ("PASS", "FAIL"):
        return {
            "verdict": "ERROR",
            "violations": [],
            "rationale": f"Invalid verdict value: {repr(verdict)}",
            "excluded_from_aggregate": True,
        }

    clean = [v for v in violations if v in VALIDITY_VIOLATIONS]

    if verdict == "PASS" and violations:
        return {
            "verdict": "ERROR",
            "violations": [],
            "rationale": "PASS verdict with non-empty violations — schema inconsistency.",
            "excluded_from_aggregate": True,
        }

    if verdict == "FAIL" and not clean:
        return {
            "verdict": "ERROR",
            "violations": [],
            "rationale": "FAIL verdict with no recognised violations — schema inconsistency.",
            "excluded_from_aggregate": True,
        }

    return {
        "verdict": verdict,
        "violations": clean,
        "rationale": rationale,
        "excluded_from_aggregate": verdict != "PASS",
    }


def classify_output_validity(client, fixture_path, output_path):
    """Call validity classifier for one source + output pair. Returns a validity dict."""
    try:
        fix_b64, fix_mime = load_image_b64(fixture_path)
        out_b64, out_mime = load_image_b64(output_path)

        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text",  "text": "Image 1 — SOURCE (original room photo):"},
                    {"type": "image", "source": {"type": "base64", "media_type": fix_mime, "data": fix_b64}},
                    {"type": "text",  "text": "Image 2 — GENERATED output:"},
                    {"type": "image", "source": {"type": "base64", "media_type": out_mime, "data": out_b64}},
                    {"type": "text",  "text": VALIDITY_CLASSIFIER_PROMPT},
                ],
            }],
        )

        raw = response.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        parsed = json.loads(raw.strip())
        return _validate_classifier_result(parsed)

    except Exception as e:
        return {
            "verdict": "ERROR",
            "violations": [],
            "rationale": f"Classifier call failed: {e}",
            "excluded_from_aggregate": True,
        }


def evaluate_case_with_ai(client, fixture_path, run_dir, case, cfg):
    """Call Claude to evaluate one comparison. Returns parsed dict or None."""
    try:
        import anthropic as _anthropic  # lazy import — only needed if AI eval runs

        pipes   = cfg["pipelines"]
        slug_a  = pipes[0]["slug"]
        slug_b  = pipes[1]["slug"]
        img_a   = case["results"].get(slug_a, {}).get("image")
        img_b   = case["results"].get(slug_b, {}).get("image")

        if not img_a or not img_b:
            print("    ⚠ missing output images — skipping AI eval")
            return None

        fix_b64, fix_mime = load_image_b64(fixture_path)
        ba_b64,  ba_mime  = load_image_b64(run_dir / img_a)
        nb_b64,  nb_mime  = load_image_b64(run_dir / img_b)

        debug_raw  = json.dumps(case["results"].get(slug_b, {}).get("debug", {}), indent=2)
        debug_excerpt = debug_raw[:2500] + ("\n... (truncated)" if len(debug_raw) > 2500 else "")

        prompt = EVAL_PROMPT.format(
            style_name=case["style"],
            bucket=case["bucket"],
            bucket_description=BUCKET_DESCRIPTIONS.get(case["bucket"], ""),
            room_type=case["room"],
            debug_excerpt=debug_excerpt,
        )

        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1800,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text",  "text": "Image 1 — INPUT (original room photo):"},
                    {"type": "image", "source": {"type": "base64", "media_type": fix_mime, "data": fix_b64}},
                    {"type": "text",  "text": "Image 2 — BASELINE output:"},
                    {"type": "image", "source": {"type": "base64", "media_type": ba_mime,  "data": ba_b64}},
                    {"type": "text",  "text": "Image 3 — NEWEST BUILD output:"},
                    {"type": "image", "source": {"type": "base64", "media_type": nb_mime,  "data": nb_b64}},
                    {"type": "text",  "text": prompt},
                ],
            }],
        )

        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw.strip())

        # Attach pre-computed weighted scores
        weights = cfg["scoring_weights"]
        result["baseline"]["weighted_score"]    = weighted_ai_score(result["baseline"],    weights)
        result["newest_build"]["weighted_score"] = weighted_ai_score(result["newest_build"], weights)

        return result

    except Exception as e:
        print(f"    ⚠ AI eval error: {e}")
        return None


def run_ai_evaluation(run_dir, manifest, cfg):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("\n[ERROR] Missing ANTHROPIC_API_KEY environment variable.")
        print("Please copy .env.example to .env and provide your key.")
        print("Skipping AI evaluation.")
        return manifest

    try:
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=api_key)
    except ImportError:
        print("\nanthropic package not installed. Run: pip install anthropic")
        print("Skipping AI evaluation.")
        return manifest

    total = len(manifest["cases"])
    print(f"\nRunning AI evaluation ({total} cases)...")

    for i, case in enumerate(manifest["cases"]):
        cid     = case["case_id"]
        fixture = FIXTURES / case["fixture"]
        print(f"  [{i+1}/{total}] {case['room']} + {case['style']}...", end="", flush=True)

        result = evaluate_case_with_ai(client, fixture, run_dir, case, cfg)
        case["ai_evaluation"] = result
        print(" ✓" if result else " ✗ (failed)")

    # Persist AI evaluations back to manifest
    (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def run_validity_classification(run_dir, manifest, cfg):
    """Classify every generated output for validity. Saves results to manifest."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("\n[ERROR] Missing ANTHROPIC_API_KEY environment variable.")
        print("Skipping validity classification.")
        return manifest

    try:
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=api_key)
    except ImportError:
        print("\nanthropic package not installed — skipping validity classification.")
        return manifest

    pipes = cfg["pipelines"]
    total = len(manifest["cases"])
    print(f"\nRunning validity classification ({total} cases × {len(pipes)} pipelines)...")

    for i, case in enumerate(manifest["cases"]):
        fixture = FIXTURES / case["fixture"]
        print(f"  [{i+1}/{total}] {case['room']} + {case['style']}", end="", flush=True)

        validity = {}
        for pipe in pipes:
            slug     = pipe["slug"]
            res_info = case["results"].get(slug, {})
            img_name = res_info.get("image")

            if not img_name or res_info.get("status") != "ok":
                validity[slug] = {
                    "verdict": "ERROR",
                    "violations": [],
                    "rationale": "Generation failed — no output to classify.",
                    "excluded_from_aggregate": True,
                }
                print(f"  {slug}:skip", end="", flush=True)
                continue

            v   = classify_output_validity(client, fixture, run_dir / img_name)
            sym = "P" if v["verdict"] == "PASS" else ("F" if v["verdict"] == "FAIL" else "E")
            validity[slug] = v
            print(f"  {slug}:{sym}", end="", flush=True)

        case["validity"] = validity
        print()

    (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def apply_validity_to_winners(run_dir, manifest, cfg):
    """Override AI-suggested winners using validity verdicts. Saves updated manifest."""
    pipes   = cfg["pipelines"]
    slug_a  = pipes[0]["slug"]
    slug_b  = pipes[1]["slug"]
    label_a = pipes[0]["label"]
    label_b = pipes[1]["label"]

    for case in manifest["cases"]:
        ai_eval  = case.get("ai_evaluation")
        validity = case.get("validity", {})
        if not ai_eval:
            continue

        va = validity.get(slug_a, {}).get("verdict", "ERROR")
        vb = validity.get(slug_b, {}).get("verdict", "ERROR")
        a_valid = (va == "PASS")
        b_valid = (vb == "PASS")

        if a_valid and not b_valid:
            ai_eval["winner"]            = label_a
            ai_eval["validity_override"] = True
        elif b_valid and not a_valid:
            ai_eval["winner"]            = label_b
            ai_eval["validity_override"] = True
        elif not a_valid and not b_valid:
            ai_eval["winner"]            = "Neither"
            ai_eval["validity_override"] = True
        # both valid → keep original AI winner unchanged

    (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest

# ── report constants ──────────────────────────────────────────────────────────

SCORE_LABELS = {
    "structural_fidelity":          "Structural Fidelity",
    "window_exterior_preservation": "Window / Exterior Preservation",
    "style_fidelity":               "Style Fidelity",
    "material_hierarchy":           "Material Hierarchy",
    "staging_density":              "Staging Density",
    "functional_realism":           "Functional Realism",
    "design_fidelity":              "Design Fidelity",
    "defects_artifacts":            "Defects / Artifacts",
}

SCORE_DESCRIPTIONS = {
    "structural_fidelity":          ("5=identical geometry/camera/layout", "3=minor drift", "1=structural changes"),
    "window_exterior_preservation": ("5=unchanged", "3=minor treatment differences", "1=altered aperture or exterior"),
    "style_fidelity":               ("5=unmistakable style", "3=diluted or generic", "1=wrong or collapsed style"),
    "material_hierarchy":           ("5=clear contrast, intentional surfaces", "3=acceptable but flat", "1=monochrome or incoherent"),
    "staging_density":              ("5=correct for bucket", "3=slightly off", "1=empty, cluttered, or mismatched"),
    "functional_realism":           ("5=usable, logical placement", "3=minor issues", "1=unusable or illogical"),
    "design_fidelity":              ("5=strong intent, lighting depth", "3=clean but flat", "1=featureless or confused"),
    "defects_artifacts":            ("5=none", "3=minor issues", "1=obvious artifacts or distortions"),
}

# ── report html builders ──────────────────────────────────────────────────────

def img_tag(name, alt):
    return f'<img src="{name}" alt="{alt}" onerror="this.style.display=\'none\'">'


def _validity_badge_html(verdict):
    cls = {"PASS": "vbadge-pass", "FAIL": "vbadge-fail", "ERROR": "vbadge-error"}.get(verdict, "vbadge-unknown")
    label = verdict if verdict else "—"
    return f'<span class="validity-badge {cls}">{label}</span>'


def _validity_banner_html(verdict, violations, rationale):
    if verdict == "PASS" or not verdict:
        return ""
    title = "EXCLUDED — validity failure" if verdict == "FAIL" else "EXCLUDED — classifier error"
    viol_str = " · ".join(v.replace("_", " ") for v in violations) if violations else "see rationale"
    return (
        f'<div class="validity-banner vbanner-{verdict.lower()}">'
        f'<span class="vb-title">{title}</span>'
        f'<span class="vb-violations">{viol_str}</span>'
        f'<span class="vb-rationale">{rationale}</span>'
        f'</div>'
    )


def _get_validity(case, slug):
    """Return the validity dict for a pipeline slug, with safe defaults."""
    v = (case.get("validity") or {}).get(slug, {})
    return {
        "verdict":                 v.get("verdict", ""),
        "violations":              v.get("violations", []),
        "rationale":               v.get("rationale", ""),
        "excluded_from_aggregate": v.get("excluded_from_aggregate", False),
    }


def ai_score_badge(score):
    if score is None:
        return '<span class="ai-badge ai-none">AI: —</span>'
    color = "#5aad6a" if score >= 4 else "#d5a55b" if score >= 3 else "#d05050"
    return f'<span class="ai-badge" style="color:{color}" title="AI suggested score">AI: {score}</span>'


def ai_reject_badge(rule, rejections):
    flagged = rule in (rejections or [])
    if flagged:
        return '<span class="ai-reject-flag ai-flagged" title="AI suggests this rule may apply">AI: Flag</span>'
    return '<span class="ai-reject-flag ai-pass" title="AI did not flag this rule">AI: Pass</span>'


def debug_section(slug, debug):
    if not debug:
        return ""
    escaped = json.dumps(debug, indent=2).replace("</", "<\\/")
    return f"""
    <details class="debug-block">
      <summary>Debug metadata — {slug}</summary>
      <pre>{escaped}</pre>
    </details>"""


def ai_diagnostic_section(ai_eval):
    if not ai_eval:
        return ""
    lines = []
    if ai_eval.get("rationale"):
        lines.append(f'<div class="diag-row"><span class="diag-label">Winner rationale</span><span class="diag-val">{ai_eval["rationale"]}</span></div>')
    if ai_eval.get("key_regression"):
        lines.append(f'<div class="diag-row"><span class="diag-label diag-reg">Key regression</span><span class="diag-val">{ai_eval["key_regression"]}</span></div>')
    if ai_eval.get("key_improvement"):
        lines.append(f'<div class="diag-row"><span class="diag-label diag-imp">Key improvement</span><span class="diag-val">{ai_eval["key_improvement"]}</span></div>')
    if ai_eval.get("prompt_config_note"):
        lines.append(f'<div class="diag-row"><span class="diag-label">Config note</span><span class="diag-val diag-config">{ai_eval["prompt_config_note"]}</span></div>')
    if not lines:
        return ""
    return f"""
    <div class="ai-diagnostic">
      <div class="diag-header">AI Diagnostic Notes</div>
      {"".join(lines)}
    </div>"""


def case_html(case, weights, rejection_rules, pipes):
    cid      = case["case_id"]
    results  = case["results"]
    ai_eval  = case.get("ai_evaluation") or {}
    pipe_a   = pipes[0]
    pipe_b   = pipes[1]
    slug_a   = pipe_a["slug"]
    slug_b   = pipe_b["slug"]
    img_a    = results.get(slug_a, {}).get("image", "")
    img_b    = results.get(slug_b, {}).get("image", "")
    err_a    = results.get(slug_a, {}).get("error", "")
    err_b    = results.get(slug_b, {}).get("error", "")
    debug_b  = results.get(slug_b, {}).get("debug", {})

    # validity per pipeline
    val_a = _get_validity(case, slug_a)
    val_b = _get_validity(case, slug_b)
    va_verdict    = val_a["verdict"]
    vb_verdict    = val_b["verdict"]
    va_excl       = val_a["excluded_from_aggregate"]
    vb_excl       = val_b["excluded_from_aggregate"]

    ai_a     = ai_eval.get("baseline", {})
    ai_b     = ai_eval.get("newest_build", {})
    ai_rej_a = ai_a.get("hard_rejections", [])
    ai_rej_b = ai_b.get("hard_rejections", [])

    has_ai   = bool(ai_eval)

    # ai winner line
    if has_ai:
        ai_winner    = ai_eval.get("winner", "—")
        ai_winner_cls = {
            pipe_a["label"]: "win-a",
            pipe_b["label"]: "win-b",
            "Baseline":      "win-a",
            "Newest Build":  "win-b",
            "Tie / subjective": "win-tie",
            "Neither":          "win-neither",
        }.get(ai_winner, "")
        ai_score_a   = ai_a.get("weighted_score", "—")
        ai_score_b   = ai_b.get("weighted_score", "—")
        override_note = (' <span class="validity-override-note">(validity gate applied)</span>'
                         if ai_eval.get("validity_override") else "")
        ai_winner_html = f"""
        <div class="ai-winner-row">
          <span class="ai-winner-label">AI Suggested</span>
          <span class="winner-name {ai_winner_cls}">{ai_winner}</span>{override_note}
          <span class="ai-scores-inline">({pipe_a['label']}: {ai_score_a} · {pipe_b['label']}: {ai_score_b})</span>
        </div>"""
    else:
        ai_winner_html = '<div class="ai-winner-row ai-none-row">AI evaluation not available</div>'

    # scoring rows
    inv_a = " score-cell-invalid" if va_excl else ""
    inv_b = " score-cell-invalid" if vb_excl else ""

    weight_rows = ""
    for key, label in SCORE_LABELS.items():
        w     = weights[key]
        tip   = " · ".join(SCORE_DESCRIPTIONS[key])
        ba_ai = ai_a.get(key)
        nb_ai = ai_b.get(key)
        weight_rows += f"""
        <tr>
          <td class="metric-name" title="{tip}">{label}</td>
          <td class="weight">{int(w*100)}%</td>
          <td class="score-cell{inv_a}">
            {ai_score_badge(ba_ai)}
            <select class="score" data-case="{cid}" data-metric="{key}" data-pipeline="{slug_a}" onchange="recalc('{cid}')">
              <option value="">Human –</option>
              <option value="1">1</option><option value="2">2</option>
              <option value="3">3</option><option value="4">4</option>
              <option value="5">5</option>
            </select>
          </td>
          <td class="score-cell{inv_b}">
            {ai_score_badge(nb_ai)}
            <select class="score" data-case="{cid}" data-metric="{key}" data-pipeline="{slug_b}" onchange="recalc('{cid}')">
              <option value="">Human –</option>
              <option value="1">1</option><option value="2">2</option>
              <option value="3">3</option><option value="4">4</option>
              <option value="5">5</option>
            </select>
          </td>
        </tr>"""

    # rejection rows
    rejection_rows = ""
    for rule in rejection_rules:
        rejection_rows += f"""
        <tr>
          <td colspan="2" class="rejection-label">{rule}</td>
          <td class="score-cell{inv_a}">
            {ai_reject_badge(rule, ai_rej_a)}
            <label class="reject-check"><input type="checkbox" class="reject" data-case="{cid}" data-pipeline="{slug_a}" onchange="recalc('{cid}')"> Human: Fail</label>
          </td>
          <td class="score-cell{inv_b}">
            {ai_reject_badge(rule, ai_rej_b)}
            <label class="reject-check"><input type="checkbox" class="reject" data-case="{cid}" data-pipeline="{slug_b}" onchange="recalc('{cid}')"> Human: Fail</label>
          </td>
        </tr>"""

    err_banner_a  = f'<div class="error-banner">API Error: {err_a}</div>' if err_a else ""
    err_banner_b  = f'<div class="error-banner">API Error: {err_b}</div>' if err_b else ""
    bucket_badge  = f'<span class="bucket bucket-{case["bucket"].lower()}">{case["bucket"]}</span>'

    return f"""
  <section class="case" id="{cid}">
    <div class="case-header">
      <h2>{case['room']} <span class="sep">·</span> {case['style']} {bucket_badge}</h2>
    </div>

    <div class="image-grid">
      <div class="image-panel{' image-panel-invalid' if va_excl else ''}">
        <div class="panel-label">{pipe_a['label']} {_validity_badge_html(va_verdict)}</div>
        {err_banner_a}
        {img_tag(img_a, pipe_a['label']) if img_a else '<div class="no-image">No output</div>'}
        {_validity_banner_html(va_verdict, val_a['violations'], val_a['rationale'])}
      </div>
      <div class="image-panel{' image-panel-invalid' if vb_excl else ''}">
        <div class="panel-label">{pipe_b['label']} {_validity_badge_html(vb_verdict)}</div>
        {err_banner_b}
        {img_tag(img_b, pipe_b['label']) if img_b else '<div class="no-image">No output</div>'}
        {_validity_banner_html(vb_verdict, val_b['violations'], val_b['rationale'])}
      </div>
    </div>

    <table class="score-table">
      <thead>
        <tr>
          <th>Metric</th><th>Weight</th>
          <th>{pipe_a['label']}{'<span class="col-diagnostic"> diagnostic only</span>' if va_excl else ''}</th>
          <th>{pipe_b['label']}{'<span class="col-diagnostic"> diagnostic only</span>' if vb_excl else ''}</th>
        </tr>
      </thead>
      <tbody>
        {weight_rows}
        <tr class="divider-row"><td colspan="4"><strong>Hard Rejection Rules</strong></td></tr>
        {rejection_rows}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="2"><strong>Human Weighted Score</strong></td>
          <td><span class="total" id="total-{cid}-{slug_a}">—</span></td>
          <td><span class="total" id="total-{cid}-{slug_b}">—</span></td>
        </tr>
        <tr class="total-row ai-total-row">
          <td colspan="2"><span class="ai-label-inline">AI Weighted Score</span></td>
          <td><span class="ai-total">{ai_a.get('weighted_score', '—')}</span></td>
          <td><span class="ai-total">{ai_b.get('weighted_score', '—')}</span></td>
        </tr>
        <tr class="total-row">
          <td colspan="2"><strong>Hard Rejected</strong></td>
          <td><span class="reject-flag" id="reject-{cid}-{slug_a}">—</span></td>
          <td><span class="reject-flag" id="reject-{cid}-{slug_b}">—</span></td>
        </tr>
        <tr class="winner-row">
          <td colspan="4">
            {ai_winner_html}
            <div class="human-winner-row">
              <span class="human-winner-label">Human Final</span>
              <div class="winner-block" id="winner-{cid}">
                <span class="winner-name">—</span>
                <span class="winner-rationale"></span>
              </div>
            </div>
          </td>
        </tr>
      </tfoot>
    </table>

    {ai_diagnostic_section(ai_eval)}

    <div class="notes-block">
      <label>Human Notes / Rationale</label>
      <textarea rows="2" placeholder="One-sentence rationale and any observations..."></textarea>
    </div>

    {debug_section(slug_b, debug_b)}
  </section>"""


# ── report generator ──────────────────────────────────────────────────────────

def generate_report(run_dir, manifest, cfg):
    weights         = cfg["scoring_weights"]
    rejection_rules = cfg["hard_rejection_rules"]
    pipes           = cfg["pipelines"]

    weights_js = json.dumps(weights)
    pipes_js   = json.dumps([p["slug"] for p in pipes])

    # Build AI summary data for the summary section
    ai_summary = {"available": False, "win_a": 0, "win_b": 0, "ties": 0, "neither": 0,
                  "avg_a": None, "avg_b": None, "hard_rej_a": 0, "hard_rej_b": 0}
    slug_a  = pipes[0]["slug"]
    slug_b  = pipes[1]["slug"]
    label_a = pipes[0]["label"]
    label_b = pipes[1]["label"]

    # validity-aware aggregation
    valid_scores_a, valid_scores_b = [], []
    all_scores_a,   all_scores_b   = [], []
    fail_count_a  = fail_count_b  = 0
    error_count_a = error_count_b = 0
    failures_list = []  # [{room, style, pipeline, verdict, violations, rationale}]

    ai_scores_a, ai_scores_b = [], []
    total_cases = len(manifest["cases"])

    for case in manifest["cases"]:
        ae       = case.get("ai_evaluation")
        val_ca   = _get_validity(case, slug_a)
        val_cb   = _get_validity(case, slug_b)

        # tally validity counts and build failures list
        for val, slug, pipe_label in [(val_ca, slug_a, label_a), (val_cb, slug_b, label_b)]:
            v = val["verdict"]
            if v == "FAIL":
                fail_count_a  += (slug == slug_a)
                fail_count_b  += (slug == slug_b)
                failures_list.append({
                    "room": case["room"], "style": case["style"],
                    "pipeline": pipe_label, "verdict": "FAIL",
                    "violations": val["violations"], "rationale": val["rationale"],
                })
            elif v == "ERROR":
                error_count_a += (slug == slug_a)
                error_count_b += (slug == slug_b)
                failures_list.append({
                    "room": case["room"], "style": case["style"],
                    "pipeline": pipe_label, "verdict": "ERROR",
                    "violations": [], "rationale": val["rationale"],
                })

        if not ae:
            continue
        ai_summary["available"] = True
        w = ae.get("winner", "")
        if w in (label_a, "Baseline"):       ai_summary["win_a"] += 1
        elif w in (label_b, "Newest Build"): ai_summary["win_b"] += 1
        elif w == "Tie / subjective":        ai_summary["ties"]   += 1
        elif w == "Neither":                 ai_summary["neither"] += 1

        sa = ae.get("baseline",     {}).get("weighted_score")
        sb = ae.get("newest_build", {}).get("weighted_score")
        if sa is not None:
            ai_scores_a.append(sa)
            all_scores_a.append(sa)
            if not val_ca["excluded_from_aggregate"]:
                valid_scores_a.append(sa)
        if sb is not None:
            ai_scores_b.append(sb)
            all_scores_b.append(sb)
            if not val_cb["excluded_from_aggregate"]:
                valid_scores_b.append(sb)

        if ae.get("baseline",     {}).get("hard_rejections"): ai_summary["hard_rej_a"] += 1
        if ae.get("newest_build", {}).get("hard_rejections"): ai_summary["hard_rej_b"] += 1

    if ai_scores_a: ai_summary["avg_a"] = round(sum(ai_scores_a) / len(ai_scores_a), 2)
    if ai_scores_b: ai_summary["avg_b"] = round(sum(ai_scores_b) / len(ai_scores_b), 2)

    # validity KPI values
    valid_n_a   = len(valid_scores_a)
    valid_n_b   = len(valid_scores_b)
    invalid_n_a = fail_count_a + error_count_a
    invalid_n_b = fail_count_b + error_count_b
    fail_pct_a  = round((invalid_n_a / total_cases * 100) if total_cases else 0)
    fail_pct_b  = round((invalid_n_b / total_cases * 100) if total_cases else 0)
    valid_avg_a = round(sum(valid_scores_a) / valid_n_a, 2) if valid_n_a else None
    valid_avg_b = round(sum(valid_scores_b) / valid_n_b, 2) if valid_n_b else None

    low_valid_warning = ""
    if ai_summary["available"]:
        if valid_n_a < 2 or valid_n_b < 2 or (valid_n_a + valid_n_b) < 5:
            low_valid_warning = (
                '<div class="low-valid-warning">'
                '⚠ Insufficient valid outputs for reliable comparison.'
                '</div>'
            )

    cases_html = "\n".join(
        case_html(c, weights, rejection_rules, pipes)
        for c in manifest["cases"]
    )

    label_a = pipes[0]["label"]
    label_b = pipes[1]["label"]

    ai_summary_html = ""
    if ai_summary["available"]:
        ai_summary_html = f"""
    <div class="ai-summary-panel">
      <div class="summary-panel-label">AI Suggested Summary</div>
      <div class="summary-grid">
        <div class="stat-card"><span class="value">{ai_summary['win_a']}</span><div class="label">{label_a} wins</div></div>
        <div class="stat-card"><span class="value">{ai_summary['win_b']}</span><div class="label">{label_b} wins</div></div>
        <div class="stat-card"><span class="value">{ai_summary['ties']}</span><div class="label">Ties</div></div>
        <div class="stat-card"><span class="value">{ai_summary['neither']}</span><div class="label">Both failed</div></div>
      </div>
      <div class="avg-row">
        <div class="avg-card"><span class="avg-value">{ai_summary['avg_a'] or '—'}</span><div class="avg-label">Avg score — {label_a}</div></div>
        <div class="avg-card"><span class="avg-value">{ai_summary['avg_b'] or '—'}</span><div class="avg-label">Avg score — {label_b}</div></div>
      </div>
      <div class="hard-rej-row">
        Hard rejections flagged by AI: &nbsp;
        <strong>{label_a}: {ai_summary['hard_rej_a']}</strong> &nbsp;·&nbsp;
        <strong>{label_b}: {ai_summary['hard_rej_b']}</strong>
      </div>
    </div>"""
    else:
        ai_summary_html = '<div class="ai-summary-panel ai-none-panel">AI evaluation was not run for this report.</div>'

    # ── validity KPI panel ────────────────────────────────────────────────────
    if ai_summary["available"]:
        validity_kpi_html = f"""
    <div class="validity-kpi-panel">
      <div class="summary-panel-label">Validity Classification</div>
      <div class="validity-kpi-grid">
        <div class="kpi-card"><span class="kpi-value kpi-green">{valid_n_a}/{total_cases}</span><div class="kpi-label">Valid — {label_a}</div></div>
        <div class="kpi-card"><span class="kpi-value kpi-green">{valid_n_b}/{total_cases}</span><div class="kpi-label">Valid — {label_b}</div></div>
        <div class="kpi-card"><span class="kpi-value {'kpi-red' if fail_pct_a else 'kpi-muted'}">{fail_pct_a}%</span><div class="kpi-label">Failure Rate — {label_a}</div></div>
        <div class="kpi-card"><span class="kpi-value {'kpi-red' if fail_pct_b else 'kpi-muted'}">{fail_pct_b}%</span><div class="kpi-label">Failure Rate — {label_b}</div></div>
      </div>
      {low_valid_warning}
      <div class="avg-row">
        <div class="avg-card"><span class="avg-value">{valid_avg_a or '—'}</span><div class="avg-label">Valid Avg — {label_a}</div></div>
        <div class="avg-card"><span class="avg-value">{valid_avg_b or '—'}</span><div class="avg-label">Valid Avg — {label_b}</div></div>
      </div>
    </div>"""
    else:
        validity_kpi_html = ""

    # ── failures table ────────────────────────────────────────────────────────
    if failures_list:
        rows = ""
        for f in failures_list:
            viol_str = ", ".join(v.replace("_", " ") for v in f["violations"]) if f["violations"] else "—"
            verdict_cls = "ftv-fail" if f["verdict"] == "FAIL" else "ftv-error"
            rows += (
                f'<tr>'
                f'<td>{f["room"]}</td>'
                f'<td>{f["style"]}</td>'
                f'<td>{f["pipeline"]}</td>'
                f'<td><span class="ftv-badge {verdict_cls}">{f["verdict"]}</span></td>'
                f'<td class="ft-violations">{viol_str}</td>'
                f'<td class="ft-rationale">{f["rationale"]}</td>'
                f'</tr>'
            )
        failures_table_html = f"""
    <div class="failures-table-section">
      <h3 class="ft-header">Validity Failures</h3>
      <table class="failures-table">
        <thead><tr><th>Room</th><th>Style</th><th>Pipeline</th><th>Verdict</th><th>Violations</th><th>Rationale</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>"""
    else:
        failures_table_html = (
            '<div class="failures-table-section">'
            '<div class="ft-none">No validity failures — all outputs passed classification.</div>'
            '</div>'
            if ai_summary["available"] else ""
        )

    # ── optimization advice ───────────────────────────────────────────────────
    advice_html = ""
    advice_path = run_dir / "optimization_advice.md"
    if advice_path.exists():
        try:
            content = advice_path.read_text(encoding='utf-8')
            advice_html = f"""
    <div class="optimization-advice-section">
      <h3 class="ft-header">AI Prompt Optimization Recommendations</h3>
      <div class="advice-content-box">
        <pre>{content}</pre>
      </div>
    </div>"""
        except Exception as e:
            advice_html = f'<div class="advice-error">Failed to load optimization advice: {e}</div>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Regression Report — {manifest['run_id']}</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    background: #0d0f14;
    color: #d4d8e1;
    line-height: 1.5;
  }}

  header {{
    background: #13161d;
    border-bottom: 1px solid #222730;
    padding: 20px 32px;
    display: flex;
    align-items: baseline;
    gap: 16px;
  }}
  header h1 {{ font-size: 16px; font-weight: 600; color: #f0f2f5; letter-spacing: 0.02em; }}
  header .meta {{ color: #6b7280; font-size: 12px; }}
  .container {{ max-width: 1400px; margin: 0 auto; padding: 32px; }}

  .case {{
    background: #13161d;
    border: 1px solid #1e2230;
    border-radius: 8px;
    margin-bottom: 40px;
    overflow: hidden;
  }}
  .case-header {{
    padding: 16px 20px;
    border-bottom: 1px solid #1e2230;
    background: #0f1118;
  }}
  .case-header h2 {{ font-size: 15px; font-weight: 600; color: #e8eaf0; }}
  .sep {{ color: #3a3f50; margin: 0 6px; }}

  .bucket {{
    display: inline-block; font-size: 10px; font-weight: 700;
    letter-spacing: 0.08em; padding: 2px 7px; border-radius: 3px;
    vertical-align: middle; margin-left: 6px;
  }}
  .bucket-low    {{ background: #1a2a1a; color: #5aad6a; border: 1px solid #2d4d2d; }}
  .bucket-medium {{ background: #1a1f2a; color: #5b9bd5; border: 1px solid #2a3550; }}
  .bucket-high   {{ background: #2a1a1a; color: #d58b5b; border: 1px solid #4d2d2d; }}

  .image-grid {{
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    border-bottom: 1px solid #1e2230;
  }}
  .image-panel {{ padding: 12px; border-right: 1px solid #1e2230; }}
  .image-panel:last-child {{ border-right: none; }}
  .panel-label {{
    font-size: 11px; font-weight: 600; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;
  }}
  .image-panel img {{
    width: 100%; display: block; border-radius: 4px; border: 1px solid #1e2230;
  }}
  .no-image {{
    width: 100%; aspect-ratio: 4/3; background: #0d0f14;
    border: 1px dashed #2a2f3a; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    color: #3a3f50; font-size: 12px;
  }}
  .error-banner {{
    background: #2a0f0f; color: #e07070; border: 1px solid #4a1f1f;
    border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; font-size: 11px;
  }}

  .score-table {{ width: 100%; border-collapse: collapse; }}
  .score-table th, .score-table td {{
    padding: 7px 12px; border-bottom: 1px solid #1a1e28;
    text-align: left; vertical-align: middle;
  }}
  .score-table th {{
    background: #0f1118; font-size: 11px; font-weight: 600;
    color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em;
  }}
  .score-table tbody tr:hover {{ background: #161922; }}
  .metric-name {{ color: #c0c6d4; cursor: default; }}
  .weight {{ color: #4a5060; font-size: 11px; }}

  /* score cell — stacks AI badge above human dropdown */
  .score-cell {{ display: flex; flex-direction: column; gap: 4px; min-width: 110px; }}
  .ai-badge {{
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    background: #0a0c12; border: 1px solid #2a2f3a;
    border-radius: 3px; padding: 1px 6px; display: inline-block;
    width: fit-content;
  }}
  .ai-badge.ai-none {{ color: #3a3f50; }}

  .score-table select {{
    background: #0d0f14; color: #d4d8e1;
    border: 1px solid #2a2f3a; border-radius: 4px;
    padding: 3px 6px; font-size: 12px; cursor: pointer; width: 90px;
  }}

  .divider-row td {{
    background: #0a0c12; color: #5b6270; font-size: 11px;
    padding: 6px 12px; border-top: 1px solid #1e2230;
  }}
  .rejection-label {{ color: #8a6060; font-size: 12px; }}
  .ai-reject-flag {{
    font-size: 10px; font-weight: 700; padding: 1px 6px;
    border-radius: 3px; display: inline-block; margin-bottom: 3px;
  }}
  .ai-flagged {{ background: #2a1010; color: #d05050; border: 1px solid #4a2020; }}
  .ai-pass    {{ background: #0f1a0f; color: #5aad6a; border: 1px solid #1f3a1f; }}
  .reject-check {{ display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; color: #8a90a0; }}
  .reject-check input {{ cursor: pointer; }}

  .total-row td {{ background: #0f1118; padding: 8px 12px; }}
  .ai-total-row td {{ background: #0a0c12; }}
  .total {{ font-size: 15px; font-weight: 700; color: #e8eaf0; }}
  .ai-total {{ font-size: 13px; font-weight: 600; color: #7a90b0; }}
  .ai-label-inline {{ font-size: 11px; color: #5b6a80; font-style: italic; }}
  .reject-flag {{ font-size: 12px; font-weight: 600; }}
  .reject-flag.failed {{ color: #d05050; }}
  .reject-flag.passed {{ color: #5aad6a; }}

  .winner-row td {{ background: #0a0c12; padding: 10px 14px; }}
  .ai-winner-row {{
    display: flex; align-items: center; gap: 8px;
    padding: 6px 0; border-bottom: 1px solid #1a1e28; margin-bottom: 6px;
  }}
  .ai-winner-label {{
    font-size: 10px; font-weight: 700; color: #5b6a80;
    text-transform: uppercase; letter-spacing: 0.06em; width: 100px; flex-shrink: 0;
  }}
  .ai-none-row {{ color: #3a3f50; font-size: 11px; font-style: italic; padding: 4px 0 8px; }}
  .ai-scores-inline {{ font-size: 11px; color: #5b6270; }}
  .human-winner-row {{ display: flex; align-items: center; gap: 8px; padding: 4px 0; }}
  .human-winner-label {{
    font-size: 10px; font-weight: 700; color: #7a8090;
    text-transform: uppercase; letter-spacing: 0.06em; width: 100px; flex-shrink: 0;
  }}
  .winner-block {{ display: flex; align-items: center; gap: 6px; }}
  .winner-name {{ font-weight: 700; font-size: 14px; color: #e8eaf0; }}
  .winner-name.win-a {{ color: #5b9bd5; }}
  .winner-name.win-b {{ color: #5aad6a; }}
  .winner-name.win-tie {{ color: #d5a55b; }}
  .winner-name.win-neither {{ color: #d05050; }}
  .winner-rationale {{ color: #6b7280; font-style: italic; font-size: 12px; }}

  /* ai diagnostic notes */
  .ai-diagnostic {{
    border-top: 1px solid #1e2230;
    padding: 12px 16px;
    background: #0a0e16;
  }}
  .diag-header {{
    font-size: 10px; font-weight: 700; color: #3a5080;
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;
  }}
  .diag-row {{
    display: flex; gap: 12px; margin-bottom: 5px; align-items: baseline;
  }}
  .diag-label {{
    font-size: 10px; font-weight: 700; color: #5b6270;
    text-transform: uppercase; letter-spacing: 0.05em;
    min-width: 130px; flex-shrink: 0;
  }}
  .diag-label.diag-reg {{ color: #8a4040; }}
  .diag-label.diag-imp {{ color: #3a6a50; }}
  .diag-val {{ font-size: 12px; color: #a0a8b8; line-height: 1.5; }}
  .diag-val.diag-config {{ color: #6a80a0; font-style: italic; }}

  .notes-block {{
    padding: 12px 16px; border-top: 1px solid #1e2230; background: #0f1118;
  }}
  .notes-block label {{
    display: block; font-size: 11px; color: #5b6270; margin-bottom: 5px;
    text-transform: uppercase; letter-spacing: 0.06em;
  }}
  .notes-block textarea {{
    width: 100%; background: #0d0f14; border: 1px solid #2a2f3a; border-radius: 4px;
    color: #c0c6d4; font-size: 12px; padding: 7px 10px; resize: vertical; font-family: inherit;
  }}

  .debug-block {{ border-top: 1px solid #1e2230; }}
  .debug-block summary {{
    padding: 9px 16px; cursor: pointer; font-size: 11px; color: #5b6270;
    background: #0a0c12; user-select: none;
  }}
  .debug-block summary:hover {{ color: #8a90a0; }}
  .debug-block pre {{
    padding: 12px 16px; font-size: 11px; color: #7a8090; background: #080a0f;
    overflow-x: auto; white-space: pre-wrap; word-break: break-all;
  }}

  /* ── summary ── */
  .summary {{
    background: #13161d; border: 1px solid #1e2230;
    border-radius: 8px; padding: 24px; margin-top: 48px;
  }}
  .summary h2 {{
    font-size: 14px; font-weight: 600; color: #e8eaf0;
    margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #1e2230;
  }}
  .summary-panels {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }}
  .summary-panel-label {{
    font-size: 10px; font-weight: 700; color: #5b6270;
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;
  }}
  .ai-summary-panel {{ padding: 16px; background: #0a0e16; border: 1px solid #1a2230; border-radius: 6px; }}
  .human-summary-panel {{ padding: 16px; background: #0f1118; border: 1px solid #1e2230; border-radius: 6px; }}
  .ai-none-panel {{ color: #3a3f50; font-size: 12px; font-style: italic; padding: 16px; }}
  .summary-grid {{
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;
  }}
  .stat-card {{
    background: #0d0f14; border: 1px solid #1e2230; border-radius: 6px;
    padding: 10px; text-align: center;
  }}
  .stat-card .value {{ font-size: 22px; font-weight: 700; color: #e8eaf0; display: block; margin-bottom: 2px; }}
  .stat-card .label {{ font-size: 10px; color: #5b6270; }}
  .avg-row {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }}
  .avg-card {{
    background: #0d0f14; border: 1px solid #1e2230; border-radius: 6px;
    padding: 10px; text-align: center;
  }}
  .avg-card .avg-value {{ font-size: 18px; font-weight: 700; color: #e8eaf0; display: block; }}
  .avg-card .avg-label {{ font-size: 10px; color: #5b6270; }}
  .hard-rej-row {{ font-size: 11px; color: #7a8090; padding-top: 4px; }}
  .recommendation {{
    margin-top: 16px; padding: 14px; border-radius: 6px;
    font-size: 13px; font-weight: 600; text-align: center; letter-spacing: 0.04em;
  }}
  .rec-promote {{ background: #0f2a1a; border: 1px solid #1f5a35; color: #5aad6a; }}
  .rec-retest  {{ background: #1a1a0f; border: 1px solid #5a5020; color: #d5b55b; }}
  .rec-reject  {{ background: #2a0f0f; border: 1px solid #5a2020; color: #d05050; }}

  .disagreements {{
    margin-top: 16px; padding: 14px;
    background: #0d0f14; border: 1px solid #1e2230; border-radius: 6px;
  }}
  .disagreements h3 {{
    font-size: 11px; font-weight: 700; color: #5b6270;
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;
  }}
  .disagreements ul {{ list-style: none; }}
  .disagreements li {{ font-size: 12px; color: #8a90a0; padding: 3px 0; }}
  .dis-empty {{ color: #3a3f50; font-style: italic; }}

  /* ── validity badges ── */
  .validity-badge {{
    display: inline-block; font-size: 9px; font-weight: 800;
    letter-spacing: 0.08em; padding: 1px 6px; border-radius: 3px;
    vertical-align: middle; margin-left: 6px; text-transform: uppercase;
  }}
  .vbadge-pass  {{ background: #0f2a1a; color: #5aad6a; border: 1px solid #1f5a35; }}
  .vbadge-fail  {{ background: #2a0f0f; color: #d05050; border: 1px solid #5a2020; }}
  .vbadge-error {{ background: #1a1a0a; color: #d5a55b; border: 1px solid #5a4020; }}
  .vbadge-unknown {{ background: #0d0f14; color: #3a3f50; border: 1px solid #2a2f3a; }}

  /* ── validity banners ── */
  .validity-banner {{
    margin-top: 8px; padding: 8px 10px; border-radius: 4px; font-size: 11px;
    display: flex; flex-direction: column; gap: 3px;
  }}
  .vbanner-fail  {{ background: #2a0f0f; border: 1px solid #5a2020; }}
  .vbanner-error {{ background: #1a1508; border: 1px solid #5a4010; }}
  .vb-title  {{ font-weight: 700; color: #e07070; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }}
  .vbanner-error .vb-title {{ color: #d5a55b; }}
  .vb-violations {{ color: #c06060; font-size: 11px; }}
  .vbanner-error .vb-violations {{ color: #b08050; }}
  
  /* ── optimization advice ── */
  .optimization-advice-section {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #222730; }}
  .advice-content-box {{
    background: #0a0c12; border: 1px solid #1a2230; border-radius: 8px;
    padding: 24px; margin-top: 16px;
  }}
  .advice-content-box pre {{
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px; line-height: 1.6; color: #a0a8b8;
    white-space: pre-wrap; word-break: break-word;
  }}
  .vb-rationale  {{ color: #8a5050; font-size: 11px; font-style: italic; }}
  .vbanner-error .vb-rationale {{ color: #806040; }}

  /* ── invalid image panel ── */
  .image-panel-invalid {{ opacity: 0.75; border-left: 2px solid #5a2020; }}

  /* ── invalid score cells ── */
  .score-cell-invalid {{ opacity: 0.4; pointer-events: none; }}

  /* ── col diagnostic label ── */
  .col-diagnostic {{
    font-size: 9px; font-weight: 600; color: #d05050;
    text-transform: uppercase; letter-spacing: 0.06em;
    display: block; margin-top: 2px;
  }}

  /* ── validity override note ── */
  .validity-override-note {{
    font-size: 10px; color: #d5a55b; font-style: italic; margin-left: 4px;
  }}

  /* ── validity KPI panel ── */
  .validity-kpi-panel {{
    padding: 16px; background: #0a0f0a; border: 1px solid #1a2a1a;
    border-radius: 6px; margin-bottom: 20px;
  }}
  .validity-kpi-grid {{
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;
  }}
  .kpi-card {{
    background: #0d0f14; border: 1px solid #1e2230; border-radius: 6px;
    padding: 10px; text-align: center;
  }}
  .kpi-value {{ font-size: 20px; font-weight: 700; display: block; margin-bottom: 2px; }}
  .kpi-label {{ font-size: 10px; color: #5b6270; }}
  .kpi-green {{ color: #5aad6a; }}
  .kpi-red   {{ color: #d05050; }}
  .kpi-muted {{ color: #5aad6a; }}
  .low-valid-warning {{
    background: #2a1a08; border: 1px solid #5a3010; color: #d5a55b;
    border-radius: 4px; padding: 7px 12px; font-size: 11px; margin-bottom: 10px;
  }}

  /* ── failures table ── */
  .failures-table-section {{
    margin-top: 16px; padding: 14px;
    background: #0d0f14; border: 1px solid #1e2230; border-radius: 6px;
  }}
  .ft-header {{
    font-size: 11px; font-weight: 700; color: #5b6270;
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;
  }}
  .ft-none {{ color: #3a3f50; font-size: 12px; font-style: italic; }}
  .failures-table {{ width: 100%; border-collapse: collapse; font-size: 11px; }}
  .failures-table th, .failures-table td {{
    padding: 6px 10px; border-bottom: 1px solid #1a1e28; text-align: left;
  }}
  .failures-table th {{
    background: #0a0c12; color: #5b6270; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px;
  }}
  .failures-table tbody tr:hover {{ background: #111418; }}
  .ftv-badge {{
    display: inline-block; font-size: 9px; font-weight: 800;
    padding: 1px 6px; border-radius: 3px; letter-spacing: 0.06em;
  }}
  .ftv-fail  {{ background: #2a0f0f; color: #d05050; border: 1px solid #5a2020; }}
  .ftv-error {{ background: #1a1508; color: #d5a55b; border: 1px solid #5a4010; }}
  .ft-violations {{ color: #8a6060; max-width: 280px; }}
  .ft-rationale  {{ color: #6b7280; font-style: italic; max-width: 320px; }}
</style>
</head>
<body>

<header>
  <h1>Visual Regression Report</h1>
  <div class="meta">
    Run ID: {manifest['run_id']} &nbsp;·&nbsp;
    {manifest['timestamp'][:19].replace('T', ' ')} &nbsp;·&nbsp;
    {label_a} vs {label_b} &nbsp;·&nbsp;
    {len(manifest['cases'])} test cases
    {"&nbsp;·&nbsp; AI evaluation included" if ai_summary['available'] else ""}
  </div>
</header>

<div class="container">

{cases_html}

<div class="summary" id="summary">
  <h2>Final Summary</h2>
  {validity_kpi_html}
  <div class="summary-panels">
    {ai_summary_html}
    <div class="human-summary-panel">
      <div class="summary-panel-label">Human Final Summary</div>
      <div class="summary-grid">
        <div class="stat-card"><span class="value" id="sum-win-a">—</span><div class="label">{label_a} wins</div></div>
        <div class="stat-card"><span class="value" id="sum-win-b">—</span><div class="label">{label_b} wins</div></div>
        <div class="stat-card"><span class="value" id="sum-ties">—</span><div class="label">Ties</div></div>
        <div class="stat-card"><span class="value" id="sum-both-fail">—</span><div class="label">Both failed</div></div>
      </div>
      <div class="avg-row">
        <div class="avg-card"><span class="avg-value" id="avg-a">—</span><div class="avg-label">Avg — {label_a}</div></div>
        <div class="avg-card"><span class="avg-value" id="avg-b">—</span><div class="avg-label">Avg — {label_b}</div></div>
      </div>
      <div class="recommendation" id="recommendation">Score all cases to generate recommendation.</div>
    </div>
  </div>

  <div class="disagreements" id="disagreements">
    <h3>AI vs Human Disagreements</h3>
    <ul id="dis-list"><li class="dis-empty">Score cases to see disagreements.</li></ul>
  </div>

  {failures_table_html}
  {advice_html}
</div>

</div>

<script>
const WEIGHTS = {weights_js};
const PIPES   = {pipes_js};
const SLUG_A  = "{slug_a}";
const SLUG_B  = "{slug_b}";
const LABEL_A = "{label_a}";
const LABEL_B = "{label_b}";

// AI evaluation data embedded at report generation time
const AI_EVALS = {json.dumps({c["case_id"]: c.get("ai_evaluation") for c in manifest["cases"]})};

function getScore(caseId, metric, pipeline) {{
  const el = document.querySelector(`.score[data-case="${{caseId}}"][data-metric="${{metric}}"][data-pipeline="${{pipeline}}"]`);
  return el ? parseFloat(el.value) || null : null;
}}

function isRejected(caseId, pipeline) {{
  const boxes = document.querySelectorAll(`.reject[data-case="${{caseId}}"][data-pipeline="${{pipeline}}"]`);
  return Array.from(boxes).some(b => b.checked);
}}

function weightedScore(caseId, pipeline) {{
  let total = 0, covered = 0;
  for (const [key, w] of Object.entries(WEIGHTS)) {{
    const s = getScore(caseId, key, pipeline);
    if (s !== null) {{ total += s * w; covered += w; }}
  }}
  return covered > 0 ? total / covered : null;
}}

function humanWinner(caseId) {{
  const rejA = isRejected(caseId, SLUG_A), rejB = isRejected(caseId, SLUG_B);
  const sA   = weightedScore(caseId, SLUG_A), sB = weightedScore(caseId, SLUG_B);
  if (rejA && rejB) return "Neither";
  if (rejA) return LABEL_B;
  if (rejB) return LABEL_A;
  if (sA !== null && sB !== null) {{
    if (Math.abs(sA - sB) <= 0.25) return "Tie / subjective";
    return sA > sB ? LABEL_A : LABEL_B;
  }}
  return null;
}}

function winnerClass(w) {{
  if (w === LABEL_A || w === "Baseline")    return "win-a";
  if (w === LABEL_B || w === "Newest Build") return "win-b";
  if (w === "Tie / subjective") return "win-tie";
  if (w === "Neither")          return "win-neither";
  return "";
}}

function recalc(caseId) {{
  const rejA = isRejected(caseId, SLUG_A), rejB = isRejected(caseId, SLUG_B);
  const sA   = weightedScore(caseId, SLUG_A), sB  = weightedScore(caseId, SLUG_B);

  for (const [slug, rej, s] of [[SLUG_A, rejA, sA], [SLUG_B, rejB, sB]]) {{
    const te = document.getElementById(`total-${{caseId}}-${{slug}}`);
    const re = document.getElementById(`reject-${{caseId}}-${{slug}}`);
    if (te) te.textContent = s !== null ? s.toFixed(2) : "—";
    if (re) {{
      re.textContent = rej ? "FAILED" : "Pass";
      re.className   = "reject-flag " + (rej ? "failed" : "passed");
    }}
  }}

  const w     = humanWinner(caseId);
  const wEl   = document.getElementById(`winner-${{caseId}}`);
  if (wEl) {{
    const nameEl = wEl.querySelector(".winner-name");
    const noteEl = wEl.querySelector(".winner-rationale");
    if (nameEl) {{
      nameEl.textContent = w || "—";
      nameEl.className   = "winner-name " + (w ? winnerClass(w) : "");
    }}
    if (noteEl && w) {{
      if (w === "Neither") noteEl.textContent = "Both outputs failed a hard rejection rule.";
      else if (w === "Tie / subjective") noteEl.textContent = `Scores within 0.25 (${{sA?.toFixed(2)}} vs ${{sB?.toFixed(2)}}).`;
      else noteEl.textContent = `${{w}} scored higher (${{(sA > sB ? sA : sB)?.toFixed(2)}} vs ${{(sA > sB ? sB : sA)?.toFixed(2)}}).`;
    }}
  }}

  updateSummary();
}}

function updateSummary() {{
  const cases = document.querySelectorAll(".case");
  let winA = 0, winB = 0, ties = 0, bothFail = 0;
  let sumA = 0, sumB = 0, countA = 0, countB = 0;
  const disagreements = [];

  cases.forEach(c => {{
    const cid = c.id;
    const hw  = humanWinner(cid);
    if (!hw) return;

    if (hw === "Neither") bothFail++;
    else if (hw === LABEL_A) winA++;
    else if (hw === LABEL_B) winB++;
    else if (hw.startsWith("Tie")) ties++;

    const sA = weightedScore(cid, SLUG_A), sB = weightedScore(cid, SLUG_B);
    if (sA !== null) {{ sumA += sA; countA++; }}
    if (sB !== null) {{ sumB += sB; countB++; }}

    // check disagreement with AI
    const ae = AI_EVALS[cid];
    if (ae && ae.winner) {{
      const aiW = ae.winner === "Baseline" ? LABEL_A : ae.winner === "Newest Build" ? LABEL_B : ae.winner;
      if (aiW !== hw) disagreements.push({{ cid, aiW, hw }});
    }}
  }});

  document.getElementById("sum-win-a").textContent     = winA;
  document.getElementById("sum-win-b").textContent     = winB;
  document.getElementById("sum-ties").textContent      = ties;
  document.getElementById("sum-both-fail").textContent = bothFail;
  document.getElementById("avg-a").textContent = countA ? (sumA/countA).toFixed(2) : "—";
  document.getElementById("avg-b").textContent = countB ? (sumB/countB).toFixed(2) : "—";

  const rec = document.getElementById("recommendation");
  if (!countA || !countB) {{
    rec.textContent = "Score all test cases to generate recommendation.";
    rec.className   = "recommendation";
  }} else {{
    const avgA = sumA/countA, avgB = sumB/countB, diff = avgB - avgA;
    if (bothFail > 2) {{
      rec.textContent = "REJECT — Too many hard rejections in newest build.";
      rec.className   = "recommendation rec-reject";
    }} else if (diff > 0.3 && winB > winA) {{
      rec.textContent = "PROMOTE — Newest build meaningfully outperforms baseline.";
      rec.className   = "recommendation rec-promote";
    }} else if (diff < -0.2 || winA > winB + 2) {{
      rec.textContent = "REJECT — Newest build regresses vs baseline.";
      rec.className   = "recommendation rec-reject";
    }} else {{
      rec.textContent = "RETEST — Results are close or mixed. Expand test matrix before deciding.";
      rec.className   = "recommendation rec-retest";
    }}
  }}

  const disList = document.getElementById("dis-list");
  if (disList) {{
    if (!disagreements.length) {{
      disList.innerHTML = `<li class="dis-empty">${{countA ? "No disagreements between AI and human scoring." : "Score cases to see disagreements."}}</li>`;
    }} else {{
      disList.innerHTML = disagreements.map(d =>
        `<li>Case <strong>${{d.cid}}</strong>: AI suggested <em>${{d.aiW}}</em>, human scored <em>${{d.hw}}</em></li>`
      ).join("");
    }}
  }}
}}
</script>
</body>
</html>"""

    report_path = run_dir / "report.html"
    report_path.write_text(html, encoding="utf-8")
    print(f"Report   → {report_path}")
    return report_path

# ── pre-run verification ──────────────────────────────────────────────────────

def verify_and_summarize_config(cfg):
    """Print the test set configuration and run pre-flight checks. Returns True if safe to run."""
    rooms  = cfg["rooms"]
    styles = cfg["styles"]
    pipes  = cfg["pipelines"]
    ver    = cfg.get("version", "unknown")

    print("\n" + "=" * 60)
    print(f"  REGRESSION TEST SET  --  version {ver}")
    print("=" * 60)

    # Fixture existence + metadata
    print(f"\n  Rooms ({len(rooms)}):")
    missing = []
    for r in rooms:
        fp      = FIXTURES / r["fixture"]
        exists  = fp.exists()
        status  = "OK" if exists else "MISSING"
        size_kb = f"  {fp.stat().st_size // 1024}KB" if exists else ""
        print(f"    {status}  {r['label']:20s}  type={r['room_type']:15s}  fixture={r['fixture']}{size_kb}")
        if not exists:
            missing.append(r["fixture"])

    print(f"\n  Styles ({len(styles)}):")
    for s in styles:
        print(f"    · {s['name']:20s}  bucket={s['bucket']}")

    print(f"\n  Pipelines ({len(pipes)}):")
    for p in pipes:
        print(f"    · {p['label']:20s}  mode={p['mode']}")
    print("\n  Comparison assumptions:")
    print(f"    · baseline anchor: {COMPARISON_ASSUMPTIONS['baseline_anchor']}")
    print(
        "    · furniture/control benchmarks: "
        + ", ".join(COMPARISON_ASSUMPTIONS["furniture_control_benchmarks"])
    )
    print(f"    · moodboard benchmark: {COMPARISON_ASSUMPTIONS['moodboard_benchmark']}")
    print(f"    · compatibility alias: {COMPARISON_ASSUMPTIONS['compatibility_alias']}")
    print(
        "    · canonical active candidate: "
        + COMPARISON_ASSUMPTIONS["canonical_active_candidate"]
    )

    print(f"\n  Style influence: {cfg.get('style_influence', 50)}")

    # ── pre-flight checks ──────────────────────────────────────────────────────
    errors = []
    warnings = []

    if missing:
        errors.append(f"Missing fixture files: {', '.join(missing)}")

    style_ids = [s["id"] for s in styles]
    if "minimalist" in style_ids:
        errors.append("Minimalist is still present in styles — must be replaced before running.")

    if "japandi" not in style_ids:
        warnings.append("Japandi not found in styles — expected as the LOW bucket replacement.")

    configured_modes = {p["mode"] for p in pipes}
    required_modes = {mode for modes in BENCHMARK_MODE_MATRIX.values() for mode in modes}
    missing_modes = sorted(required_modes - configured_modes)
    if missing_modes:
        warnings.append(
            "Configured pipeline list is missing benchmark/comparison modes: "
            + ", ".join(missing_modes)
        )

    for p in pipes:
        expected_role = SEMANTIC_ROLES.get(p["mode"])
        actual_role = p.get("role")
        if expected_role and actual_role != expected_role:
            warnings.append(
                f"Pipeline semantic role mismatch for {p['mode']}: expected {expected_role}, got {actual_role or '(missing)'}"
            )

    if len(rooms) == 0:
        errors.append("No rooms configured.")

    if warnings:
        print()
        for w in warnings:
            print(f"  WARNING: {w}")

    print()
    if errors:
        for e in errors:
            print(f"  BLOCKED: {e}")
        print("\n  Simulation blocked. Resolve the above before proceeding.\n")
        print("=" * 60 + "\n")
        return False

    print("  OK  All pre-flight checks passed. Ready to run simulation.")
    print("=" * 60 + "\n")
    return True

# ── entrypoint ────────────────────────────────────────────────────────────────

def main():
    cfg      = load_config()
    skip_ai  = "--skip-ai" in sys.argv

    if len(sys.argv) >= 3 and sys.argv[1] == "--report-only":
        run_dir  = Path(sys.argv[2])
        manifest = json.loads((run_dir / "manifest.json").read_text())
        generate_report(run_dir, manifest, cfg)
        return

    if len(sys.argv) >= 3 and sys.argv[1] == "--eval-only":
        run_dir  = Path(sys.argv[2])
        manifest = json.loads((run_dir / "manifest.json").read_text())
        manifest = run_ai_evaluation(run_dir, manifest, cfg)
        manifest = run_validity_classification(run_dir, manifest, cfg)
        apply_validity_to_winners(run_dir, manifest, cfg)
        generate_report(run_dir, manifest, cfg)
        return

    if not verify_and_summarize_config(cfg):
        sys.exit(1)

    proc = start_backend(cfg["api_base"])
    try:
        run_dir, manifest = run_tests(cfg)
        if not skip_ai:
            manifest = run_ai_evaluation(run_dir, manifest, cfg)
            manifest = run_validity_classification(run_dir, manifest, cfg)
            apply_validity_to_winners(run_dir, manifest, cfg)
            
            # Run the Prompt Optimizer automatically
            print("\nRunning Prompt Optimizer...")
            optimizer_script = TESTS_DIR / "optimize_prompts.py"
            if optimizer_script.exists():
                subprocess.run([sys.executable, str(optimizer_script), str(run_dir)], check=False)
            else:
                # Fallback if we are in a sub-test-suite
                optimizer_script = TESTS_DIR.parent / "regression" / "optimize_prompts.py"
                if optimizer_script.exists():
                    subprocess.run([sys.executable, str(optimizer_script), str(run_dir)], check=False)

        generate_report(run_dir, manifest, cfg)
    finally:
        if proc:
            proc.terminate()
            print("Backend stopped.")

if __name__ == "__main__":
    main()
