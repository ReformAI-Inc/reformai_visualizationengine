# ReformAI Visualization Engine -- Platform Status (Authoritative)
**Last Verified:** 2026-06-11

## 1. Canonical Runtime
- Default pipeline mode: `balanced_v7`
- Canonical orchestration: AGT extraction/classification + generation
- API entrypoint: `POST /generate-visualization?mode=<pipeline>`

## 2. Pipeline Lifecycle
All paths are relative to `apps/vis-service/src/`.

| Mode | Lifecycle | Handler Location |
|---|---|---|
| `baseline_original` | Historical baseline anchor | `pipelines/legacy-services/baseline/geminiService.ts` |
| `balanced_v1` to `balanced_v4_1` | Historical benchmark family | `pipelines/legacy-services/*` |
| `balanced_v5` | Frozen benchmark reference | `pipelines/versions/balanced-v5/index.ts` |
| `balanced_v6` | Explicit comparison pipeline | `pipelines/versions/balanced-v6/index.ts` |
| `balanced_v7` | Canonical active candidate | `pipelines/versions/balanced-v7/index.ts` |
| `balanced_v8` | Catalogue-first comparison candidate | `pipelines/versions/balanced-v8/index.ts` |
| `improved_current` | Historical comparison path | `pipelines/legacy-services/improved/geminiService.ts` |

## 3. Routing Semantics
- Mode resolution lives in `pipelines/core/pipeline-routing.ts`.
- Omitted mode resolves to `balanced_v7`.
- `balanced_v6` resolves to its own explicit handler module (no silent V6->V5 handler alias).

## 4. Current Source Layout
```
apps/vis-service/src/
+-- transport/   HTTP/controller/request/schema layer
+-- pipelines/   routing, dispatcher, core composer, version handlers
+-- prompts/     prompt templates, blocks, shared prompt contracts
+-- guardrails/  AGT extraction/classification and structural guardrails
+-- models/      Gemini/provider execution clients
+-- catalog/     contractor catalogue registry + resolver
+-- shared/      shared contracts/types/validation/registries
+-- index.ts     Fastify bootstrap
```

## 5. Validation Status
- `npm --workspace apps/vis-service run build` -> PASS
- `npm --workspace apps/vis-service run test:contracts` -> PASS
- `npm --workspace apps/web-sandbox run build` -> PASS

## 6. Drift Prevention
Any lifecycle/path/semantics change must update:
1. `docs/PLATFORM_STATUS.md` (this file)
2. `docs/CURRENT_STATE.md`
3. `apps/vis-service/README.md` and root `README.md` if flow or structure changes
