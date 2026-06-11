# ReformAI Visualization Engine -- Current State
**Last Updated:** 2026-06-11

Authoritative lifecycle source: `docs/PLATFORM_STATUS.md`

## Runtime Summary
- Canonical active pipeline: `balanced_v7`
- Catalogue-first comparison candidate: `balanced_v8` (regression pending; not canonical)
- Comparison mode `balanced_v6`: explicit alias of the `balanced_v5` handler (declared in routing, surfaced in debug metadata)
- Historical benchmark modes remain callable for comparison/regression workflows

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
| AGT extraction/classification | `apps/vis-service/src/guardrails/` |
| Model execution | `apps/vis-service/src/models/gemini.client.ts` |
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

## Deployment Topology
`Browser -> Netlify CDN -> netlify/functions/api.mjs -> Cloud Run (Fastify) -> Gemini`
