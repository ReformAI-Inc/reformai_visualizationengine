# Regression Profiles

## The Gate (promotion authority — gate_version 2.0, judge_version 2.0)
- Config: `tests/regression/config.gate.yaml` · Runner: `gate.py` · Ledger: `runs/ledger.jsonl` (main checkout)
- 12 canonical cases (4 rooms × 3 style-pressure buckets) × `repeats: 3` independent generations
  per pipeline; per-case score = median across repeats; blinded judging (anonymous OUTPUT A/B,
  deterministic position swap, no pipeline metadata sent to the judge).
- Verdict rules: 0 candidate hard rejections (any repeat counts) · 0 validity-classifier FAILs ·
  median drop ≤0.25 vs the accepted `baseline_mode` (`balanced_v7`) baseline · no single case
  drops >1.0 · NO_BASELINE = FAIL. Infra-invalid evidence (skipped cases, <12 base cases,
  validity gaps, session-judged manifests) → exit 2, NO verdict.
- Commands:
  - `python gate.py --candidate <mode>` — gate a candidate vs production (paid; credit preflight first)
  - `python gate.py --run-dir runs/<run> --dry-run` — re-verdict an existing run, no spend
  - `python run_regression.py --resume runs/<run>` — surgical repair of an interrupted run
    (regenerates failed generations, judges unjudged cases, fills missing/ERROR validity;
    set `REGRESSION_CONFIG` to the run's config, e.g. `config.gate.derived.yaml`)
- Accepted baseline (2026-07-02): `balanced_v7` median 4.15 (run_20260702_222504).
  NB2 evidence: Run A PASS 4.38 (run_20260702_225242); Run B verifyAGT-ON PASS 4.40
  (run_20260702_232200) — verification repaired 2/36 first-attempt hard-fact violations.
- Image mime is sniffed from magic bytes (`sniff_image_mime`) — NB2 returns JPEG under `.png`
  filenames; never trust extensions.

## AGT Extractor Accuracy Check
- `npm --workspace apps/vis-service run check:extractor` — N extraction runs per labeled fixture
  (`fixtures/agt_labels.json`); reports hard-fact precision (target ≥90%), false-hard rate (≤5%),
  boolean accuracy, tier drift. Run before changing `AGT_EXTRACTION_MODEL` or the extraction prompt.
  Baseline (gemini-2.5-flash, 2026-07-03): precision 100%, false-hard 0%.

## Fast Canonical Regression
- Config: `tests/regression/config.yaml`
- Purpose: fast baseline-vs-canonical validation.
- Expected modes: `baseline_original`, `balanced_v7`.
- Preflight command:
  - `npm run regression:preflight`
- Behavior:
  - Non-strict preflight.
  - Warns if full benchmark matrix modes are not present.
  - Validates semantic roles for configured modes when `role` is present.

## Full Product-Evolution Benchmark Regression
- Config: `tests/regression/config.full_matrix.yaml` (v4 rows removed 2026-07-02 with the legacy archive)
- Purpose: validate product-evolution comparison coverage across major milestones.
- Expected modes:
  - `baseline_original` (historical anchor)
  - `balanced_v5` (moodboard benchmark)
  - `balanced_v6` (compatibility/alias behavior)
  - `balanced_v7` (canonical active candidate)
- Preflight command:
  - `npm run regression:preflight:full`
- Behavior:
  - Strict preflight.
  - Fails if required benchmark matrix modes are incomplete.
  - Fails if configured mode semantic roles do not match `runtime_assumptions.json`.

## Parser Note
- `tests/regression/preflight.mjs` intentionally uses a lightweight line parser for the `pipelines` list.
- Supported shape: each pipeline entry must include `- mode:` and may include `role:` on following lines.
- If config structure becomes more complex, switch to a YAML parser dependency.
