# ReformAI Visualization Engine -- Platform Status (Authoritative)
**Last Verified:** 2026-07-03
**Design authority for target architecture:** `docs/ENGINE_BLUEPRINT.md`

## 0. Migration Status (the headline)
- Production model `gemini-2.5-flash-image` shuts down **2026-10-02**.
- **NB2 promotion evidence is COMPLETE and PASSING** (gate 2.0, judge 2.0, 3× repeats):
  - V7 baseline: PASS, median 4.15, accepted (run_20260702_222504)
  - Run A — `balanced_v7_nb2` (verifyAGT OFF): **PASS, median 4.38 (+0.23 vs V7), 0 hard rejections, 0 validity fails** (run_20260702_225242)
  - Run B — NB2 + verifyAGT ON: **PASS, median 4.40; verification caught and corrected 2/36 first-attempt hard-fact violations** (run_20260702_232200)
  - AGT extractor baseline (`gemini-2.5-flash`): hard-fact precision 100%, false-hard 0% (`npm run check:extractor`; labels in `fixtures/agt_labels.json`, human review pending)
- **Pending: human sign-off to flip `DEFAULT_IMAGE_MODEL` → `gemini-3.1-flash-image`** (two-key promotion), then production cutover per `docs/REPO_REVIEW_AND_REBUILD_PLAN_2026-07-02.md` ADDENDUM (Reform-AI `VISUALIZATION_SERVICE_URL` + run.invoker IAM).
- Known model behavior change: **NB2 returns JPEG** (old model returned PNG). Never derive image mime from file extensions or assumptions — sniff magic bytes (harness) / use provider-reported mime (service).

## 1. Canonical Runtime
- Default pipeline mode: `balanced_v7`
- Canonical orchestration: AGT extraction/classification + generation; optional post-generation
  AGT verification with bounded retry (`verifyAGT` request field, default off; recommended ON at cutover per Run B)
- API entrypoint: `POST /generate-visualization?mode=<pipeline>`

## 2. Pipeline Lifecycle
All paths are relative to `apps/vis-service/src/`. Legacy modes `balanced_v1`–`balanced_v4_1`
and `improved_current` were **archived 2026-07-02** to repo-root `archive/legacy-pipelines/`
(they hardcoded the EOL model); their mode keys are no longer valid request input.

| Mode | Lifecycle | Handler Location |
|---|---|---|
| `baseline_original` | Regression gate's fixed visual anchor (frozen; dies at model EOL — re-freeze the anchor before 2026-10-02) | `pipelines/legacy-services/baseline/geminiService.ts` |
| `balanced_v5` | Frozen benchmark reference; serves `balanced_v6` alias | `pipelines/versions/balanced-v5/index.ts` |
| `balanced_v6` | Explicit alias of `balanced_v5` handler | `pipelines/core/pipeline-routing.ts` (HANDLER_ALIASES) |
| `balanced_v7` | Canonical production pipeline | `pipelines/versions/balanced-v7/index.ts` |
| `balanced_v7_nb2` | Migration A/B vehicle (V7 prompts on `gemini-3.1-flash-image`) — delete after the default flip | `balanced-v7/index.ts` (`generateVisualizationNB2`) |
| `balanced_v8` | Demoted; to be absorbed into V9 `product_install` profile (`ENGINE_BLUEPRINT.md` §8) | `pipelines/versions/balanced-v8/index.ts` |

## 3. Routing Semantics
- Mode resolution lives in `pipelines/core/pipeline-routing.ts` (6 valid modes post-archive).
- Omitted mode resolves to `balanced_v7`.
- `balanced_v6` is an explicit, documented alias of the `balanced_v5` handler (declared in `HANDLER_ALIASES`; the debug payload records both `pipelineMode: balanced_v6` and `aliasedToHandler: balanced_v5`).

## 4. Current Source Layout
```
apps/vis-service/src/
+-- transport/   HTTP/controller/request/schema layer
+-- pipelines/   routing, dispatcher, core composer, version handlers
+-- prompts/     prompt templates, blocks, shared prompt contracts
+-- guardrails/  AGT extraction/classification, verification (diffAGT + bounded retry)
+-- models/      provider registry, image-model client (telemetry), providers/ (gemini + pure response parsing)
+-- catalog/     contractor catalogue registry + resolver
+-- tools/       agt-extractor-check (extractor accuracy vs labeled fixtures)
+-- shared/      shared contracts/types/validation/registries
+-- index.ts     Fastify bootstrap
```

## 5. Validation Status (2026-07-03)
- `npm --workspace apps/vis-service run build` -> PASS
- `npm --workspace apps/vis-service run test:contracts` -> PASS (23 contracts, count computed)
- `npm --workspace apps/web-sandbox run build` -> PASS
- Regression gate 2.0 (`tests/regression/gate.py`): cross-mode baseline vs `balanced_v7`,
  NO_BASELINE=FAIL, validity classifier in verdict, per-case floor, min-case enforcement,
  judge provenance checks, credit preflight, 3× repeats with per-case medians,
  blinded judging (judge_version 2.0). Harness supports `--resume <run_dir>` surgical
  repair of interrupted runs. Trend record: `runs/ledger.jsonl` (main checkout).
- Provider layer: all-candidates/parts response parsing, provider-reported mime threaded
  into verification, structured `[telemetry]` line per generation.

## 6. Drift Prevention
Any lifecycle/path/semantics change must update:
1. `docs/PLATFORM_STATUS.md` (this file)
2. `docs/CURRENT_STATE.md`
3. `apps/vis-service/README.md` and root `README.md` if flow or structure changes
Significant architectural decisions additionally require an ADR (`docs/ENGINE_BLUEPRINT.md` §14).
