# vis-service

Fastify backend for the Visualization Engine.

## Canonical and Comparison Modes (5 valid modes as of 2026-10-02)
- Canonical production pipeline: `balanced_v7` (on `gemini-3.1-flash-image` in every environment)
- `balanced_v7_nb2` migration A/B vehicle: **removed** 2026-10-02 after the default flip
- Catalogue-first (demoted): `balanced_v8` — pending absorption into V9 `product_install` profile
- `balanced_v6`: explicit alias of the `balanced_v5` handler
- `baseline_original`: the regression gate's frozen visual anchor
- Legacy modes V1–V4.1/improved: **archived** to `archive/legacy-pipelines/` (no longer valid request input)

Authoritative lifecycle source: `../../docs/PLATFORM_STATUS.md`

## Dispatcher Semantics
- Request mode is resolved in `src/pipelines/core/pipeline-routing.ts`.
- Omitted mode defaults to `balanced_v7`.
- `balanced_v6` is an explicit alias of the `balanced_v5` handler (`HANDLER_ALIASES` in `pipeline-routing.ts`); debug metadata records the requested mode and the aliased handler.

## Folder Responsibilities
- `src/transport`: HTTP transport layer (controllers, multipart parsing, schemas)
- `src/pipelines`: mode routing + per-version orchestration
- `src/prompts`: prompt blocks/templates/composition contracts
- `src/guardrails`: AGT extraction/classification + structural guardrails
- `src/models`: provider integrations (Gemini client)
- `src/catalog`: contractor catalogue registry + selection resolver
- `src/shared`: shared contracts/types, style/room/density registries, validation

## Request Flow
1. Transport receives multipart request and validates fields.
2. Dispatcher resolves `mode` and selects a pipeline.
3. Pipeline composes canonical prompt blocks + optional guardrail blocks.
4. Model client executes generation and returns image.
5. Transport returns image + metadata/debug payload.

## API
### Generate visualization
```http
POST /generate-visualization?mode=<pipeline>
```
`mode` is optional; default is `balanced_v7`.

Multipart fields (`multipart/form-data`):

| Field | Kind | Notes |
|---|---|---|
| `roomImage` | file, required | jpeg/png/webp, ≤10MB |
| `roomType`, `stylePreset` (JSON), `styleInfluence` | text, required | |
| `textPrompt` | text, optional | Free text; surface instructions (walls, floor…) go here, not as images |
| `moodBoardImages` | file, repeatable 0–10 | Tonal references only |
| `furnitureImage` | file, optional | Legacy single injected item — unchanged |
| `productImages` | file, repeatable 1–5 | Product reference images to place in the room (`MAX_INJECTED_ITEMS` = 5) |
| `productDescriptions` | text, optional | JSON array of strings, same length/order as `productImages`, e.g. `["Sofá Cusco — sofa, grey linen","Lámpara Nórdica — floor lamp"]`. Labels each reference in the prompt; omit for unlabeled items |
| `previousResultImage`, `isRefinement`, `renovationSelectionIds`, `verifyAGT`, `pipelineMode` | optional | |

400 `Validation Error` (never 500) when: both `furnitureImage` and `productImages` are sent; more than 5 `productImages`; a non-image `productImages` file; `productDescriptions` that is not a JSON string array of the same length (or is sent without `productImages`); `productImages` with `mode=baseline_original` (frozen, single `furnitureImage` only).

Pipeline support: `balanced_v7` (default), `balanced_v8`, and `balanced_v5`/`balanced_v6` accept 1–5 injected items. Each item is sent as its own labeled reference image (`[PRODUCT n: <description>]`) under one plural "place every product exactly once" instruction. With exactly one item and no description the prompt is byte-identical to the legacy single-`furnitureImage` prompt. Response shape is unchanged; `debug` adds `injectedItemCount` and `injectedItemDescriptions`.

### Catalogue endpoint
```http
GET /api/catalogue
Header: X-Contractor-Id: <contractorId>
```

## Validation Commands
### Build
```bash
npm run build
```

### Spawn-free contract checks
```bash
npm run test:contracts
```

Contract checks include:
- mode routing/default behavior
- V6 explicit handler routing parity
- AGT confidence classification behavior
- canonical prompt block ordering
- V7 AGT hierarchy insertion behavior

## Regression Profiles (repo root)
- Fast canonical preflight: `npm run regression:preflight`
- Full benchmark-matrix preflight: `npm run regression:preflight:full`

