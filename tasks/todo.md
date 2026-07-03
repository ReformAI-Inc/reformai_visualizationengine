# ReformAI Visualization Engine — Todo

## Active (priority order)
- [ ] Gate fixes (F1–F3, F6-cheap): cross-mode `--baseline-mode`, NO_BASELINE→FAIL, min_cases_evaluated=12, validity classifier in verdict, judge model to config — tests/regression/gate.py + run_regression.py + config.gate.yaml
- [ ] Provider fixes (F7, F8): all-parts image scan + mimeType threading, with unit tests — models/providers/gemini.ts, guardrails/verified-generation.ts
- [ ] Generation telemetry (F14): structured log {reqId, mode, modelId, latencyMs, attempts, verificationOutcome}; record modelId in V5/V8 debug
- [ ] Credit preflight in gate.py; top up Anthropic credits
- [ ] `--eval-only` re-judge: V7 baseline (3 session-judged cases, 24 validity ERRORs) + V8 run; re-accept baseline with sign-off
- [ ] Run A: NB2 vs V7, verifyAGT OFF, 3× repeats (promotion evidence)
- [ ] Run B: NB2 verifyAGT ON vs OFF (verification evidence, backlog-10 answer)
- [ ] On Run A PASS: make DEFAULT_IMAGE_MODEL env-overridable + flip to gemini-3.1-flash-image (models/image-model.client.ts:10)
- [ ] Backlog 14: archive legacy pipelines/prompts (hard-dated before Oct 2; fix config.full_matrix.yaml refs first)
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
