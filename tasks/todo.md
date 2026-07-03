# ReformAI Visualization Engine — Todo

## Active (priority order)
- [x] Gate fixes (F1–F3, F6-cheap): cross-mode `baseline_mode: balanced_v7`, NO_BASELINE→FAIL, min_cases_evaluated=12 + skips→exit 2, validity classifier in verdict, judge provenance check, per-case floor (max_single_case_drop 1.0), judge model to config + stamped on evals, credit preflight — gate_version 2.0. Validated $0 against June 11 runs: V8 run now FAILs (drop 0.45), invalid-evidence runs exit 2, NO_BASELINE FAILs. — 2026-07-02, fix/gate-decisiveness
- [x] Provider fixes (F7, F8): pure response-parsing module (all candidates × parts, real mimeType), threaded into verification; 23/23 contracts incl. 2 new; dist-test untracked; stale pre-monorepo package-lock regenerated — PR #9, 2026-07-02
- [x] Generation telemetry (F14): [telemetry] line per generation (provider, modelId, latencyMs, ok, bytes/error); swallowed verification-extraction failure now logs; verification outcomes log — PR #9 (V5/V8 debug modelId deferred to profile consolidation)
- [x] Credit preflight in gate.py — PR #8
- [x] Test-strategy hardening (pre-paid-runs): repeats support (config `repeats: 3`, per-case median aggregation, any-repeat rejection counts), blinded judging (judge_version 2.0 — anonymous OUTPUT A/B, deterministic position swap, no candidate metadata; 1.0 baselines orphaned by design), AGT extractor accuracy tool (`npm run check:extractor` + human-labeled fixtures/agt_labels.json — labels by Claude visual inspection, Chuck review recommended) — 2026-07-03
- [ ] **Top up Anthropic credits** (only human-blocked step)
- [ ] Run `npm run check:extractor` (F9 baseline for gemini-2.5-flash) once credits/keys confirmed — must precede Run B interpretation
- [ ] Review fixtures/agt_labels.json labels (Chuck — 10 minutes)
- [ ] `--eval-only` re-judge: V7 baseline (3 session-judged cases, 24 validity ERRORs) + V8 run; re-accept baseline with sign-off
- [ ] Run A: NB2 vs V7, verifyAGT OFF, 3× repeats (promotion evidence)
- [ ] Run B: NB2 verifyAGT ON vs OFF (verification evidence, backlog-10 answer)
- [ ] On Run A PASS: make DEFAULT_IMAGE_MODEL env-overridable + flip to gemini-3.1-flash-image (models/image-model.client.ts:10)
- [x] Backlog 14: legacy V1–V4.1 + improved archived to archive/legacy-pipelines/ (schema/type/routing/dispatcher now 6 modes, was 14); full_matrix.yaml fixed; sandbox picker trimmed + balanced_v7_nb2 option added; web-sandbox/dist untracked; contracts 23/23 — PR #11, 2026-07-02. Deferred: unused density-block entries (V5-imported registry; needs gate run). Note: baseline_original anchor itself dies at Oct 2 EOL — gate needs a re-frozen anchor before then (documented in pipelines/archived/README.md)
- [ ] Label 6 fixtures + AGT extractor accuracy check (F9) for current + successor extraction model

## Then
- [ ] **Production cutover (hard-dated before Oct 2 — production runs 2.5-flash-image, CONFIRMED):** after NB2 promotion, flip `VISUALIZATION_SERVICE_URL` in Reform-AI's api env from the old europe-west1 baseline service to the new vis-service. Prereq: auth decision — grant apps/api SA `run.invoker` on `reform-ai-vis` + ID-token minting in HttpClient (preferred) or allow-unauthenticated. Then decommission the old service.
- [ ] Add `--base-url` to run_regression.py so the gate can run against the deployed service as cutover acceptance test
- [ ] Verify EOL dates for `gemini-2.5-flash` / `gemini-2.5-flash-lite` (Reform-AI apps/api material-extraction + this repo's AGT extraction model)
- [ ] Gate v2: +catalogue cases, +scoped-edit cases, scope_compliance + product_fidelity judge dimensions (precedes V9 code)
- [ ] V9 task-profile routing (backlog 15–17), folding V8 into product_install profile — build in the ported service, not here, to avoid porting twice
- [ ] Sandbox: add verifyAGT toggle + balanced_v7_nb2 option (trivial; two shipped features unreachable from UI)
- [ ] Production hardening — now a do-not-inherit checklist for the port (auth, server-side contractor resolution, debug allowlist, async jobs vs 26s timeout, CORS); residual here: cheap shared-secret on the sandbox's public endpoint

## Parking Lot
- NB Pro hero tier (backlog 18) — after V9; real justification is reference-image product anchoring
- FLUX depth-conditioned spike (backlog 19) — needs human approval (new vendor)
- App.jsx decomposition (backlog 20) — opportunistic during V9 UI work
- Web-scraper catalogue ingestion contract (review doc §3.11) — confirm integration shape with scraper project first
- Doc consolidation: PLATFORM_STATUS + 2× CURRENT_STATE + AGENT_HANDOFF → one status doc; fix ARCHITECTURE.md §8/§10/§11
- Hygiene: delete committed dist/ + dist-test/, dead params, stale routing test, tsconfig.contract-tests ghosts, hardcoded "21/21"

## Completed
- [x] Full repo review + rebuild plan → docs/REPO_REVIEW_AND_REBUILD_PLAN_2026-07-02.md — 2026-07-02
