# ReformAI Visualization Engine -- Current State
**Last Updated:** 2026-07-03

Authoritative lifecycle source: `docs/PLATFORM_STATUS.md` · Design authority: `docs/ENGINE_BLUEPRINT.md`

## Runtime Summary
- Canonical active pipeline: `balanced_v7` on `gemini-2.5-flash-image` (EOL 2026-10-02)
- **NB2 migration: gate evidence complete and PASSING** (Run A median 4.38 vs V7 4.15; Run B verification caught 2/36 first-attempt violations). **Awaiting human sign-off for the `DEFAULT_IMAGE_MODEL` flip.**
- `balanced_v7_nb2`: migration A/B vehicle (delete after flip) · `balanced_v6`: explicit alias of `balanced_v5` · `balanced_v8`: demoted, pending V9 absorption
- Legacy modes V1–V4.1/improved archived 2026-07-02 (`archive/legacy-pipelines/`); 6 valid modes remain
- NB2 behavioral note: returns **JPEG** (old model: PNG) — mime must be sniffed/provider-reported, never assumed

## Repository Status
The backend structure cleanup is complete and now organized by responsibility under:
`apps/vis-service/src/{transport,pipelines,prompts,guardrails,models,catalog,shared}`.

## Active Source-of-Truth Paths
| Concern | Path |
|---|---|
| API bootstrap | `apps/vis-service/src/index.ts` |
| HTTP transport | `apps/vis-service/src/transport/` |
| Pipeline routing | `apps/vis-service/src/pipelines/core/pipeline-routing.ts` |
| Pipeline dispatcher | `apps/vis-service/src/pipelines/core/pipeline-dispatcher.ts` |
| V5 pipeline | `apps/vis-service/src/pipelines/versions/balanced-v5/index.ts` |
| V6 alias (no module) | `apps/vis-service/src/pipelines/core/pipeline-routing.ts` (`HANDLER_ALIASES`) |
| V7 pipeline | `apps/vis-service/src/pipelines/versions/balanced-v7/index.ts` |
| V8 pipeline | `apps/vis-service/src/pipelines/versions/balanced-v8/index.ts` |
| Prompt blocks | `apps/vis-service/src/prompts/blocks/` |
| AGT extraction/classification/verification | `apps/vis-service/src/guardrails/` |
| Model execution | `apps/vis-service/src/models/image-model.client.ts` (+ `provider-registry.ts`, `providers/gemini.ts`; `gemini.client.ts` is a legacy shim) |
| Extractor accuracy check | `apps/vis-service/src/tools/agt-extractor-check.ts` (`npm run check:extractor`) |
| Shared contracts/types | `apps/vis-service/src/shared/types/` |
| Contract tests | `apps/vis-service/src/contracts/runContracts.ts` |

## Request Flow (Simple)
1. `POST /generate-visualization` enters `transport`.
2. Multipart data is parsed/validated and assembled into typed params.
3. Dispatcher resolves `mode` (default `balanced_v7`) and selects a pipeline.
4. Pipeline composes prompt parts + guardrail context and calls model client.
5. Response returns image + metadata/debug.

## Validation Commands
- Backend build: `npm --workspace apps/vis-service run build`
- Backend contracts: `npm --workspace apps/vis-service run test:contracts`
- Frontend build: `npm --workspace apps/web-sandbox run build`
- Regression gate 2.0 (paid: live Gemini + blinded Claude judge, 3× repeats): `python tests/regression/gate.py`
  - New candidate vs production: `python tests/regression/gate.py --candidate <mode>` (compares to the accepted `balanced_v7` baseline; NO_BASELINE = FAIL)
  - Verdict on an existing run, no API spend: `python tests/regression/gate.py --run-dir runs/<run> --dry-run`
  - Repair an interrupted run: `python run_regression.py --resume runs/<run>` (set REGRESSION_CONFIG to the run's config)
  - Canonical case set + thresholds: `tests/regression/config.gate.yaml`; trend record: `runs/ledger.jsonl` (main checkout)

## Deployment Topology
`Browser -> Netlify CDN -> netlify/functions/api.mjs -> Cloud Run (Fastify) -> Gemini`
