#!/usr/bin/env python3
"""Regression gate: machine-readable PASS/FAIL on top of run_regression.py.

Usage:
  python gate.py                                  # run canonical set vs balanced_v7, judge, verdict
  python gate.py --candidate balanced_v8          # gate a different candidate mode
  python gate.py --run-dir runs/run_YYYY...       # verdict on an existing evaluated run (no generation)
  python gate.py --set-baseline [...]             # additionally record this run as the accepted baseline
  python gate.py --dry-run [...]                  # compute verdict but do not append to the ledger

Verdict rules (thresholds in config.gate.yaml under `gate:`):
  FAIL if any canonical case has a candidate hard rejection.
  FAIL if candidate median weighted score drops more than max_median_score_drop
       below the last accepted baseline for the same (candidate_mode, judge_version,
       gate_version). With no baseline on record, the score check is skipped and
       the verdict notes NO_BASELINE — run once with --set-baseline to establish one.

Every non-dry run appends one JSON line to runs/ledger.jsonl (append-only trend record).
Exit code: 0 = PASS, 1 = FAIL, 2 = usage/config error.
"""

import argparse
import json
import os
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
    """Extract candidate hard rejections and weighted scores from a 2-pipeline manifest."""
    if len(manifest.get("pipelines", [])) != 2:
        sys.exit("gate verdicts require a two-pipeline run (anchor + candidate)")
    cases, skipped = [], []
    for case in manifest["cases"]:
        ev = case.get("ai_evaluation") or {}
        cand = ev.get("newest_build")  # run_regression.py's fixed key for pipeline[1]
        if not cand or cand.get("weighted_score") is None:
            skipped.append(case["case_id"])
            continue
        cases.append({
            "case_id": case["case_id"],
            "weighted_score": cand["weighted_score"],
            "hard_rejections": cand.get("hard_rejections") or [],
        })
    if not cases:
        sys.exit("no evaluated cases found in manifest (was the run judged? try --eval-only first)")
    return cases, skipped


def last_accepted_baseline(candidate_mode, judge_version, gate_version):
    if not LEDGER.exists():
        return None
    baseline = None
    for line in LEDGER.read_text().splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        if (entry.get("accepted_baseline")
                and entry.get("candidate_mode") == candidate_mode
                and entry.get("judge_version") == judge_version
                and entry.get("gate_version") == gate_version):
            baseline = entry  # last matching wins (append-only file, chronological)
    return baseline


def main():
    ap = argparse.ArgumentParser(description="Regression gate (PASS/FAIL + ledger)")
    ap.add_argument("--candidate", default=None, help="candidate pipeline mode (default: config.gate.yaml pipelines[1])")
    ap.add_argument("--run-dir", default=None, help="verdict on an existing evaluated run directory")
    ap.add_argument("--set-baseline", action="store_true", help="record this run as the accepted baseline")
    ap.add_argument("--dry-run", action="store_true", help="compute verdict without writing the ledger")
    args = ap.parse_args()

    cfg = load_gate_config()
    candidate_mode = args.candidate or cfg["pipelines"][1]["mode"]
    judge_version = str(cfg.get("judge_version", "unversioned"))
    gate_version = str(cfg.get("gate_version", "unversioned"))
    thresholds = cfg["gate"]

    if args.run_dir:
        run_dir = Path(args.run_dir)
        if not (run_dir / "manifest.json").exists():
            sys.exit(f"no manifest.json in {run_dir}")
    else:
        run_dir = execute_regression(build_run_config(cfg, candidate_mode))

    manifest = json.loads((run_dir / "manifest.json").read_text())
    if args.run_dir:
        # Trust but verify: an existing run must match the candidate being gated.
        manifest_candidate = manifest["pipelines"][1]["mode"]
        if manifest_candidate != candidate_mode:
            candidate_mode = manifest_candidate
            print(f"note: gating manifest candidate '{candidate_mode}' from {run_dir}")

    cases, skipped = candidate_stats(manifest)
    scores = [c["weighted_score"] for c in cases]
    median_score = statistics.median(scores)
    rejected = [c for c in cases if c["hard_rejections"]]

    baseline = last_accepted_baseline(candidate_mode, judge_version, gate_version)
    failures = []
    if len(rejected) > thresholds["max_candidate_hard_rejections"]:
        for c in rejected:
            failures.append(f"hard rejection on {c['case_id']}: {'; '.join(c['hard_rejections'])}")
    if baseline:
        drop = baseline["median_score"] - median_score
        if drop > thresholds["max_median_score_drop"]:
            failures.append(
                f"median weighted score {median_score:.2f} dropped {drop:.2f} below accepted "
                f"baseline {baseline['median_score']:.2f} (run {baseline['run_id']})"
            )

    verdict = "FAIL" if failures else "PASS"
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_id": manifest.get("run_id", run_dir.name),
        "run_dir": str(run_dir.relative_to(ROOT)) if run_dir.is_relative_to(ROOT) else str(run_dir),
        "candidate_mode": candidate_mode,
        "anchor_mode": manifest["pipelines"][0]["mode"],
        "judge_version": judge_version,
        "gate_version": gate_version,
        "cases_evaluated": len(cases),
        "cases_skipped": skipped,
        "hard_rejection_count": len(rejected),
        "median_score": round(median_score, 3),
        "mean_score": round(statistics.mean(scores), 3),
        "per_case": {c["case_id"]: c["weighted_score"] for c in cases},
        "baseline_run_id": baseline["run_id"] if baseline else None,
        "verdict": verdict,
        "accepted_baseline": bool(args.set_baseline and verdict == "PASS"),
    }

    if not args.dry_run:
        RUNS_DIR.mkdir(exist_ok=True)
        with open(LEDGER, "a") as f:
            f.write(json.dumps(entry) + "\n")

    print(f"\n=== GATE {verdict} === candidate={candidate_mode} run={entry['run_id']}")
    print(f"cases={len(cases)} (skipped={len(skipped)}) hard_rejections={len(rejected)} "
          f"median={median_score:.2f} mean={entry['mean_score']:.2f}")
    if baseline:
        print(f"baseline: median {baseline['median_score']:.2f} from {baseline['run_id']}")
    else:
        print("NO_BASELINE on record for this candidate/judge/gate version "
              "(score-drop check skipped; use --set-baseline on a PASS run to establish one)")
    for f_ in failures:
        print(f"  FAIL: {f_}")
    if entry["accepted_baseline"]:
        print("recorded as accepted baseline")
    if args.dry_run:
        print("(dry run: ledger not written)")

    sys.exit(0 if verdict == "PASS" else 1)


if __name__ == "__main__":
    main()
