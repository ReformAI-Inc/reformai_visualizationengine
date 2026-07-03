# ReformAI Visualization Engine — Current State

**Last updated:** 2026-07-03 (session close)
**Status:** Active — NB2 promotion evidence complete; awaiting Chuck's flip sign-off

## What this project is
AI interior visualization engine: room photo + style + optional contractor catalogue products → photorealistic renovation of that exact room, preserving structure (windows, doors, geometry, camera). **This repo is the R&D testbed AND the production replacement:** production (`ReformAI-Inc/Reform-AI`, clone `C:\Users\cjlea\reformai`, gh account `reformai-admin`) calls the OLD baseline vis service via `VISUALIZATION_SERVICE_URL` — replacing it is a URL cutover + IAM grant, not a code port. Production breaks 2026-10-02 (model EOL) without it.

## Where we are right now
**The migration evidence is done and PASSING.** On 2026-07-02/03, gate 2.0 + judge 2.0 (blinded, 3× repeats) executed the full paid sequence:
- V7 baseline: PASS, median **4.15**, accepted (run_20260702_222504)
- Extractor baseline (gemini-2.5-flash): hard-fact precision **100%**, false-hard **0%**
- **Run A — NB2 verifyAGT OFF: PASS, median 4.38 (+0.23 vs V7), 0 hard rejections, 0 validity fails** (run_20260702_225242)
- **Run B — NB2 verifyAGT ON: PASS, median 4.40; verification caught + corrected 2/36 first-attempt hard-fact violations (~5.6% NB2 drift rate)** (run_20260702_232200)
- Three-way sanity: baseline_original 3.80–4.00 < V7 4.15 < NB2 4.38–4.40; anchor spread across runs ≈ ±0.1 = noise floor.

**THE ONE PENDING DECISION: Chuck's two-key sign-off to flip `DEFAULT_IMAGE_MODEL` → `gemini-3.1-flash-image`** (with env-overridability), plus the verifyAGT production default (recommendation: ON — Run B shows it repairs real drift; production's 120s timeout absorbs it; only the sandbox's 26s Netlify path can't).

Everything merged to main (PRs #7–#16): strategy docs + ENGINE_BLUEPRINT (design authority) · gate 2.0 · provider parsing/mime/telemetry · legacy archive (14→6 modes) · repeats + blinded judging + extractor tool · dotenv preflight fix · magic-byte mime sniffing + `--resume` repair mode · doc sync. All Cloud Run deploys succeeded.

## Stack / decisions locked in
- OPTIMIZE, not rebuild. Design authority: `docs/ENGINE_BLUEPRINT.md` (principles, stability tiers, ADR framework §14 — 11 ADRs to backfill).
- Provider strategy (PSA doc): stay on Gemini (NB2 workhorse, NB Pro hero) + FLUX.2 depth-conditioned lane as structural hedge; revisit triggers documented.
- Gate = sole promotion authority; judge vendor ≠ generator vendor; evidence must be API-produced.
- **NB2 returns JPEG (old model: PNG)** — mime is sniffed/provider-reported everywhere now; re-check downstream PNG assumptions at production cutover.

## What's next (in order)
1. **Chuck: sign off the flip** (+ verifyAGT default decision) → I flip, deploy, delete `balanced_v7_nb2` mode, ledger the promotion.
2. Production cutover: grant Reform-AI api SA `roles/run.invoker` on the new service + ID-token in its HttpClient + flip `VISUALIZATION_SERVICE_URL`; acceptance via gate `--base-url` (not yet built — small).
3. Retire `gemini-2.5-flash-image` + **re-freeze the gate anchor before 2026-10-02** (`baseline_original` calls the EOL model too).
4. Chuck: 10-min review of `fixtures/agt_labels.json` labels.
5. Then: gate v2 (catalogue/scoped cases) → V9 task profiles (absorbs V8) → FLUX depth spike. Deferred: density-block pruning (needs gate run), ledger-to-git decision, ADR backfill.

## Known issues / blockers
- None blocking. Paid-run spend 2026-07-02/03 ≈ $60–80. `runs/` + ledger live only in the main checkout.
