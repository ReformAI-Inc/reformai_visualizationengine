# vis-service

Fastify backend for the Visualization Engine.

## Canonical and Comparison Modes (6 valid modes as of 2026-07-02)
- Canonical production pipeline: `balanced_v7`
- Migration A/B vehicle: `balanced_v7_nb2` (V7 prompts on `gemini-3.1-flash-image`; gate evidence PASSING, pending default flip; deleted after flip)
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

