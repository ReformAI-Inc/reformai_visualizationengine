# ReformAI Visualization Engine — Current State

**Last updated:** 2026-07-02
**Status:** Active — migration phase, blocked on gate fixes + Anthropic credits

## What this project is
AI interior visualization engine: room photo + style + optional contractor catalogue products → photorealistic renovation of that exact room, preserving structure (windows, doors, geometry, camera). Stack: Browser → Netlify CDN → Netlify function proxy → Cloud Run Fastify (`apps/vis-service`) → Gemini image model.

**Role clarified + verified 2026-07-02: this repo is the R&D testbed; production is `ReformAI-Inc/Reform-AI`** (local clone `C:\Users\cjlea\reformai`; gh access via the `reformai-admin` account, now active in gh CLI). Verified against origin/main:
- Production `apps/api` calls the **old baseline vis service** (`reform-ai-image-visualization-service-…europe-west1.run.app`, hardcodes `gemini-2.5-flash-image`) → **production breaks Oct 2, 2026. Confirmed.**
- **Contract is drop-in compatible** with the new vis-service (same multipart fields, same response shape, no `mode` sent → default pipeline). **Replacing production = flip `VISUALIZATION_SERVICE_URL`**, not a code port. Rollback = flip back.
- Auth decision before cutover: new Cloud Run is private; production calls unauthenticated → grant apps/api SA `run.invoker` + ID-token in HttpClient (preferred) or allow-unauthenticated.
- Sandbox and production are separate Cloud Run services (sandbox deploys are safe). Production timeout 120s + 2 retries — the 26s problem is sandbox-Netlify-only; verifyAGT ON is feasible in production.
- Full details: review-doc ADDENDUM ("CONFIRMED" + "Revised migration mechanics").

## Where we are right now
- Canonical pipeline: `balanced_v7` (AGT pre-extraction) on `gemini-2.5-flash-image` (**EOL Oct 2, 2026** — migration to `gemini-3.1-flash-image`/NB2 mandatory).
- Backlog 1–9, 11, 12 done; 10, 13–20 pending. NB2 mode `balanced_v7_nb2` exists, smoke-tested.
- **2026-07-02: Full principal-engineer repo review completed** → `docs/REPO_REVIEW_AND_REBUILD_PLAN_2026-07-02.md` (24 findings F1–F24, roadmap corrections, from-scratch plan, migration path).
- **Critical discovery: the planned NB2 gate run is NOT decisive as coded.** `gate.py` keys baselines by `candidate_mode`; `balanced_v7_nb2` has none → median check skipped → auto-PASS via NO_BASELINE (proven by V8's PASS at median 3.975 vs V7's 4.425). Gate also ignores the validity classifier, silently skips cases, runs n=1, and the V7 baseline is partially session-judged with 24/24 validity ERRORs.
- Other migration blockers found: provider reads only `parts[0]` (Gemini 3.x interleaves text+image parts); `image/png` hardcoded in verification re-extraction; V8 has no modelId plumbing (can't run NB2); no server-side model-id/latency telemetry.
- Production (not migration) blockers: no auth on generate endpoint, Netlify 26s timeout, CORS `*`+credentials, debug/prompt IP returned to all callers.

## Stack / decisions locked in
- OPTIMIZE, not rebuild (re-confirmed 2026-07-02).
- Promote NB2 only after: gate fixes (F1–F3, judge config) + provider parsing fixes (F7, F8) + re-judged V7 baseline + Run A (NB2 vs V7, verifyAGT **OFF**, 3× repeats) PASS. Run B (ON vs OFF on NB2) answers the verification question separately — do NOT confound the promotion run with verifyAGT ON.
- V8 folds into V9 composition (product_install profile) rather than being migrated as a fork.
- Gate v2 (catalogue + scoped cases, scope_compliance dimension) must precede V9 code.
- AGT Rev1 tier design ("evidence, not truth") survives any refactor verbatim.

## Active work
- This worktree (`claude/lucid-meninsky-6fda42`): review doc + provider-strategy assessment + tasks scaffolding; no source changes.
- **Blueprint revision 3 (Chuck's review):** deliverable reframed from "the architecture" to "a deployable service that replaces production's visualization service with minimal ReformAI-app changes" — new Production Integration Objective section (standing test: "does this make production integration easier or harder?"), new principle #2 Production-first architecture (principles renumbered 2→3…10→11; cross-refs fixed), contract-stability rules (production API contract = most-protected Stable Core item; breaking it needs ADR + migration strategy; internal architecture free behind the frozen contract).
- **2026-07-02 master blueprint written + self-reviewed to revision 2** → `docs/ENGINE_BLUEPRINT.md` (the V2 architecture reference: 10 engineering principles up front; Stable Core vs Experimental Capabilities tiers with promote/abandon criteria per experiment; one pipeline + TaskProfiles replace mode forks; MODEL_POLICY single-source with config change control; layered geometry defense L0–L5 with the gate as lane referee; eval platform as constitution; ADR framework §14 with an 11-item backfill list; design-review record §15). Revision-2 reversals: job/queue API demoted to experimental (premature), live A/B traffic-split removed (contradicted gate-decides), quarterly judge calibration dropped, privacy/retention/training-data-terms added as cutover blockers (ADR-011), NB2-fails contingency added. Supersedes ARCHITECTURE.md §13 and IMPLEMENTATION_PLAN §5 as design authority.
- **2026-07-02 provider decision exercise complete** → `docs/PROVIDER_STRATEGY_ASSESSMENT_2026-07-02.md`. Recommendation (pending Chuck sign-off): stay on Gemini (NB2 workhorse, NB Pro hero) behind the existing registry + FLUX.2 depth-conditioned lane as the structural-preservation hedge, sequenced AFTER gate v2 so it's measurable. Key evidence: NB2 ≈ +92 Elo over current model (LMArena); NB Pro #1 on GEditBench v2; Autodesk test shows unconditioned frontier models reinvent geometry while depth-conditioned FLUX/Qwen preserve it; NB2 @1K costs $0.067 (+72% vs today, verified official pricing). Wholesale switch to OpenAI/Ideogram/Recraft rejected; self-hosting rejected below ~500k gens/mo. Research run partially hit Claude session limits (resets 8pm); interrupted claims were re-verified directly — Zillow/VSAI claims remain public-info grade.

## What's next (priority order)
1. Fix gate decisiveness: `--baseline-mode` cross-mode comparison (default `balanced_v7`), NO_BASELINE→FAIL, min_cases_evaluated=12, wire validity classifier into verdict, judge model into config (`tests/regression/gate.py`, `run_regression.py`, `config.gate.yaml`).
2. Fix provider: scan all candidate parts for image, thread real mimeType into re-extraction (`models/providers/gemini.ts:36,54`, `guardrails/verified-generation.ts:30-32,62`). Add generation telemetry log line.
3. Top up Anthropic credits (add credit preflight to gate.py); `--eval-only` re-judge V7 baseline + V8 run; then Run A and Run B.
4. On PASS: flip `DEFAULT_IMAGE_MODEL` (make env-overridable, `models/image-model.client.ts:10`); archive legacy pipelines (backlog 14, hard-dated — 9 legacy handlers hardcode the EOL model and die Oct 2).

## Known issues / blockers
- Anthropic API credits still exhausted (since 2026-06-11).
- `runs/` + `ledger.jsonl` exist only in the main checkout, not worktrees.
- Full findings register: see the review doc, section 1.1.
