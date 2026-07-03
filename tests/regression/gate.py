#!/usr/bin/env python3
"""Regression gate: machine-readable PASS/FAIL on top of run_regression.py.

Usage:
  python gate.py                                  # run canonical set vs balanced_v7, judge, verdict
  python gate.py --candidate balanced_v7_nb2      # gate a different candidate mode
  python gate.py --run-dir runs/run_YYYY...       # verdict on an existing evaluated run (no generation)
  python gate.py --set-baseline [...]             # additionally record this run as the accepted baseline
  python gate.py --dry-run [...]                  # compute verdict but do not append to the ledger
  python gate.py --baseline-mode balanced_v7      # compare against another mode's accepted baseline
                                                  # (default: gate.baseline_mode in config — this is how a
                                                  #  NEW candidate mode is judged against production)

Verdict rules (thresholds in config.gate.yaml under `gate:`):
  FAIL if any canonical case has a candidate hard rejection (judge-reported).
  FAIL if any candidate output has a validity-classifier FAIL verdict.
  FAIL if candidate median weighted score drops more than max_median_score_drop
       below the last accepted baseline for (baseline_mode, judge_version).
  FAIL if any single shared case drops more than max_single_case_drop vs baseline.
  FAIL if there is no accepted baseline to compare against (NO_BASELINE is a
       failure, not a bye — override with --allow-no-baseline only for the very
       first baseline-establishing run).

Infra-invalid runs exit 2 WITHOUT a verdict (rerun with --eval-only, then re-gate):
  - fewer than gate.min_cases_evaluated judged cases, or any skipped case
  - validity classifier coverage incomplete or in ERROR state
    (--allow-validity-gaps to re-verdict pre-gate-2.0 historical runs)
  - session-judged (hand-patched) evaluations present
    (--allow-session-judge to re-verdict historical runs; never for promotion)

Every non-dry run appends one JSON line to runs/ledger.jsonl (append-only trend record).
Exit code: 0 = PASS, 1 = FAIL, 2 = usage/config/infra error.
"""

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

TESTS_DIR = Path(__file__).resolve().parent
ROOT = TESTS_DIR.parent.parent
RUNS_DIR = ROOT / "runs"
LEDGER = RUNS_DIR / "ledger.jsonl"
GATE_CONFIG = TESTS_DIR / "config.gate.yaml"

# Same env loading as run_regression.py — the credit preflight needs
# ANTHROPIC_API_KEY before the subprocess ever runs.
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env", override=True)
except ImportError:
    pass  # rely on already-set environment variables


def load_gate_config():
    with open(GATE_CONFIG) as f:
        cfg = yaml.safe_load(f)
    if not isinstance(cfg, dict) or "gate" not in cfg:
        sys.exit("config.gate.yaml is missing the `gate:` thresholds section")
    if len(cfg.get("pipelines", [])) != 2:
        sys.exit("config.gate.yaml must define exactly two pipelines (anchor, candidate)")
    return cfg


def build_run_config(cfg, candidate_mode):
    """Write a derived config with the requested candidate mode; return its path."""
    derived = dict(cfg)
    pipelines = [dict(p) for p in cfg["pipelines"]]
    pipelines[1] = {**pipelines[1], "mode": candidate_mode}
    derived["pipelines"] = pipelines
    derived.pop("gate", None)  # run_regression.py does not consume gate thresholds
    path = TESTS_DIR / "config.gate.derived.yaml"
    path.write_text(yaml.safe_dump(derived, sort_keys=False))
    return path


def newest_run_dir(before):
    candidates = [d for d in RUNS_DIR.glob("run_*") if d.is_dir() and d not in before]
    if not candidates:
        sys.exit("run_regression.py finished but no new run directory was found in runs/")
    return max(candidates, key=lambda d: d.stat().st_mtime)


def preflight_credits(judge_model):
    """Fail fast if the Anthropic API is unusable (billing, key) BEFORE paid generation.

    Two P0 stalls (2026-06-11) came from credits running out mid-judging; this
    turns that failure mode into an upfront exit 2.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("preflight: ANTHROPIC_API_KEY is not set (judging would fail after paid generation)")
    try:
        import anthropic
    except ImportError:
        sys.exit("preflight: anthropic package not installed (pip install anthropic)")
    try:
        anthropic.Anthropic(api_key=api_key).messages.create(
            model=judge_model, max_tokens=1,
            messages=[{"role": "user", "content": "ping"}],
        )
    except Exception as e:
        sys.exit(f"preflight: Anthropic API check failed — fix before spending on generation.\n  {e}")
    print(f"preflight: Anthropic API ok (judge model {judge_model})")


def execute_regression(config_path):
    before = set(RUNS_DIR.glob("run_*"))
    env = {**os.environ, "REGRESSION_CONFIG": str(config_path)}
    proc = subprocess.run(
        [sys.executable, str(TESTS_DIR / "run_regression.py")],
        env=env, cwd=str(TESTS_DIR),
    )
    if proc.returncode != 0:
        sys.exit(f"run_regression.py exited with {proc.returncode}")
    return newest_run_dir(before)


def candidate_stats(manifest):
    """Extract candidate hard rejections, scores, judges, and validity from a 2-pipeline manifest."""
    if len(manifest.get("pipelines", [])) != 2:
        sys.exit("gate verdicts require a two-pipeline run (anchor + candidate)")
    candidate_slug = manifest["pipelines"][1].get("slug", "candidate")
    cases, skipped = [], []
    for case in manifest["cases"]:
        ev = case.get("ai_evaluation") or {}
        cand = ev.get("newest_build")  # run_regression.py's fixed key for pipeline[1]
        if not cand or cand.get("weighted_score") is None:
            skipped.append(case["case_id"])
            continue
        validity = (case.get("validity") or {}).get(candidate_slug)
        cases.append({
            "case_id": case["case_id"],
            # Repeats (run_regression `repeats: N`) share a base_case_id;
            # older manifests have neither field nor __rN suffix.
            "base_case_id": case.get("base_case_id") or re.sub(r"__r\d+$", "", case["case_id"]),
            "weighted_score": cand["weighted_score"],
            "hard_rejections": cand.get("hard_rejections") or [],
            # absent judge field = legacy API-judged manifest (pre-provenance stamping);
            # run_regression.py now stamps the API model id on every evaluation.
            "judge": ev.get("judge"),
            "validity_verdict": validity.get("verdict") if isinstance(validity, dict) else None,
            "validity_violations": (validity or {}).get("violations", []) if isinstance(validity, dict) else [],
        })
    if not cases:
        sys.exit("no evaluated cases found in manifest (was the run judged? try --eval-only first)")
    return cases, skipped


def last_accepted_baseline(baseline_mode, judge_version):
    """Last accepted baseline for baseline_mode under the same judge_version.

    Matches on judge_version but NOT gate_version: scores come from the judge,
    so judge_version is the comparability key; gate_version tracks verdict
    logic and may advance without invalidating score history.
    """
    if not LEDGER.exists():
        return None
    baseline = None
    for line in LEDGER.read_text().splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        if (entry.get("accepted_baseline")
                and entry.get("candidate_mode") == baseline_mode
                and entry.get("judge_version") == judge_version):
            baseline = entry  # last matching wins (append-only file, chronological)
    return baseline


def main():
    ap = argparse.ArgumentParser(description="Regression gate (PASS/FAIL + ledger)")
    ap.add_argument("--candidate", default=None, help="candidate pipeline mode (default: config.gate.yaml pipelines[1])")
    ap.add_argument("--baseline-mode", default=None,
                    help="mode whose accepted baseline the candidate is compared against "
                         "(default: gate.baseline_mode in config, else the candidate mode itself)")
    ap.add_argument("--run-dir", default=None, help="verdict on an existing evaluated run directory")
    ap.add_argument("--set-baseline", action="store_true", help="record this run as the accepted baseline")
    ap.add_argument("--dry-run", action="store_true", help="compute verdict without writing the ledger")
    ap.add_argument("--allow-no-baseline", action="store_true",
                    help="do not FAIL on missing baseline (ONLY for the first baseline-establishing run)")
    ap.add_argument("--allow-validity-gaps", action="store_true",
                    help="tolerate missing/ERROR validity classification (re-verdicting historical runs only)")
    ap.add_argument("--allow-session-judge", action="store_true",
                    help="tolerate session-judged evaluations (re-verdicting historical runs only; never promotion)")
    ap.add_argument("--skip-preflight", action="store_true", help="skip the Anthropic API credit preflight")
    args = ap.parse_args()

    cfg = load_gate_config()
    candidate_mode = args.candidate or cfg["pipelines"][1]["mode"]
    judge_version = str(cfg.get("judge_version", "unversioned"))
    gate_version = str(cfg.get("gate_version", "unversioned"))
    judge_model = str(cfg.get("judge_model", "claude-opus-4-7"))
    thresholds = cfg["gate"]
    baseline_mode = args.baseline_mode or thresholds.get("baseline_mode") or candidate_mode
    min_cases = int(thresholds.get("min_cases_evaluated", 0))
    max_case_drop = thresholds.get("max_single_case_drop")

    if args.run_dir:
        run_dir = Path(args.run_dir)
        if not (run_dir / "manifest.json").exists():
            sys.exit(f"no manifest.json in {run_dir}")
    else:
        if not args.skip_preflight:
            preflight_credits(judge_model)
        run_dir = execute_regression(build_run_config(cfg, candidate_mode))

    manifest = json.loads((run_dir / "manifest.json").read_text())
    if args.run_dir:
        # Trust but verify: an existing run must match the candidate being gated.
        manifest_candidate = manifest["pipelines"][1]["mode"]
        if manifest_candidate != candidate_mode:
            candidate_mode = manifest_candidate
            baseline_mode = args.baseline_mode or thresholds.get("baseline_mode") or candidate_mode
            print(f"note: gating manifest candidate '{candidate_mode}' from {run_dir}")

    cases, skipped = candidate_stats(manifest)

    # Group repeats by base case (older manifests: one repeat per base case).
    by_base = {}
    for c in cases:
        by_base.setdefault(c["base_case_id"], []).append(c)

    # ── Infra validity: a run whose evidence is incomplete gets NO verdict (exit 2) ──
    infra_problems = []
    if skipped:
        infra_problems.append(
            f"{len(skipped)} case(s) skipped (unjudged/unparseable): {', '.join(skipped)} — "
            f"rerun judging with --eval-only, then re-gate")
    if min_cases and len(by_base) < min_cases:
        infra_problems.append(f"only {len(by_base)} evaluated base cases; gate requires {min_cases}")

    session_judged = sorted({c["judge"] for c in cases if c["judge"] and str(c["judge"]).startswith("session-")})
    if session_judged and not args.allow_session_judge:
        infra_problems.append(
            f"session-judged evaluations present ({', '.join(session_judged)}) — not valid promotion "
            f"evidence; re-judge via --eval-only (or --allow-session-judge for historical re-verdicts)")

    validity_missing = [c["case_id"] for c in cases if c["validity_verdict"] is None]
    validity_errors = [c["case_id"] for c in cases if c["validity_verdict"] == "ERROR"]
    if (validity_missing or validity_errors) and not args.allow_validity_gaps:
        detail = []
        if validity_missing:
            detail.append(f"missing for {len(validity_missing)} case(s)")
        if validity_errors:
            detail.append(f"ERROR for {len(validity_errors)} case(s)")
        infra_problems.append(
            f"validity classification incomplete ({'; '.join(detail)}) — the independent structural "
            f"check must cover every case (--allow-validity-gaps for historical re-verdicts)")

    if infra_problems:
        print(f"\n=== GATE INVALID (no verdict) === candidate={candidate_mode} run={manifest.get('run_id', run_dir.name)}")
        for p in infra_problems:
            print(f"  INVALID: {p}")
        sys.exit(2)

    # ── Quality verdict ──
    # Aggregate repeats: per base case, the score is the MEDIAN across its
    # repeats (single draws are too noisy against a 0.25 threshold). Hard
    # rejections and validity FAILs on ANY repeat count — a structural
    # violation 1-in-N times is a real defect rate, not noise.
    per_case_scores = {
        base: statistics.median([c["weighted_score"] for c in group])
        for base, group in by_base.items()
    }
    repeats = max(len(g) for g in by_base.values())
    scores = list(per_case_scores.values())
    median_score = statistics.median(scores)
    rejected = [c for c in cases if c["hard_rejections"]]
    validity_failed = [c for c in cases if c["validity_verdict"] == "FAIL"]

    baseline = last_accepted_baseline(baseline_mode, judge_version)
    failures = []
    if len(rejected) > thresholds["max_candidate_hard_rejections"]:
        for c in rejected:
            failures.append(f"hard rejection on {c['case_id']}: {'; '.join(c['hard_rejections'])}")
    for c in validity_failed:
        failures.append(
            f"validity classifier FAIL on {c['case_id']}: {'; '.join(c['validity_violations']) or 'structural violation'}")
    if baseline:
        drop = baseline["median_score"] - median_score
        if drop > thresholds["max_median_score_drop"]:
            failures.append(
                f"median weighted score {median_score:.2f} dropped {drop:.2f} below accepted "
                f"baseline {baseline['median_score']:.2f} ({baseline_mode}, run {baseline['run_id']})"
            )
        if max_case_drop is not None:
            base_per_case = baseline.get("per_case") or {}
            for base_id, case_score in per_case_scores.items():
                base_score = base_per_case.get(base_id)
                if base_score is not None and (base_score - case_score) > float(max_case_drop):
                    failures.append(
                        f"single-case drop on {base_id}: {case_score:.2f} vs baseline "
                        f"{base_score:.2f} (limit {float(max_case_drop):.2f})")
    elif not args.allow_no_baseline:
        failures.append(
            f"NO_BASELINE: no accepted baseline for mode '{baseline_mode}' under judge_version "
            f"{judge_version} — a gate that cannot compare cannot pass. Establish one explicitly "
            f"(--set-baseline --allow-no-baseline on a reviewed run) or point --baseline-mode at "
            f"the production mode.")

    verdict = "FAIL" if failures else "PASS"
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_id": manifest.get("run_id", run_dir.name),
        "run_dir": str(run_dir.relative_to(ROOT)) if run_dir.is_relative_to(ROOT) else str(run_dir),
        "candidate_mode": candidate_mode,
        "baseline_mode": baseline_mode,
        "anchor_mode": manifest["pipelines"][0]["mode"],
        "judge_version": judge_version,
        "judge_model": judge_model,
        "gate_version": gate_version,
        "cases_evaluated": len(by_base),
        "repeats": repeats,
        "cases_skipped": skipped,
        "hard_rejection_count": len(rejected),
        "validity_fail_count": len(validity_failed),
        "session_judged": session_judged,
        "median_score": round(median_score, 3),
        "mean_score": round(statistics.mean(scores), 3),
        "per_case": {base: round(score, 4) for base, score in per_case_scores.items()},
        "baseline_run_id": baseline["run_id"] if baseline else None,
        "verdict": verdict,
        "accepted_baseline": bool(args.set_baseline and verdict == "PASS"),
    }

    if not args.dry_run:
        RUNS_DIR.mkdir(exist_ok=True)
        with open(LEDGER, "a") as f:
            f.write(json.dumps(entry) + "\n")

    print(f"\n=== GATE {verdict} === candidate={candidate_mode} run={entry['run_id']}")
    print(f"cases={len(by_base)} (x{repeats} repeats) hard_rejections={len(rejected)} "
          f"validity_fails={len(validity_failed)} median={median_score:.2f} mean={entry['mean_score']:.2f}")
    if baseline:
        print(f"baseline: {baseline_mode} median {baseline['median_score']:.2f} from {baseline['run_id']}")
    if session_judged:
        print(f"note: session-judged cases tolerated via --allow-session-judge ({', '.join(session_judged)})")
    if (validity_missing or validity_errors) and args.allow_validity_gaps:
        print(f"note: validity gaps tolerated via --allow-validity-gaps "
              f"(missing={len(validity_missing)}, error={len(validity_errors)})")
    for f_ in failures:
        print(f"  FAIL: {f_}")
    if entry["accepted_baseline"]:
        print("recorded as accepted baseline")
    if args.dry_run:
        print("(dry run: ledger not written)")

    sys.exit(0 if verdict == "PASS" else 1)


if __name__ == "__main__":
    main()
