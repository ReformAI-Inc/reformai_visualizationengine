# vis-service

Fastify backend for the Visualization Engine.

## Canonical and Comparison Modes
- Canonical active candidate: `balanced_v7`
- Catalogue-first comparison candidate: `balanced_v8` (regression pending)
- Explicit comparison mode: `balanced_v6` (separate pipeline module)
- Historical/frozen benchmark modes remain callable for comparison workflows.

Authoritative lifecycle source: `../../docs/PLATFORM_STATUS.md`

## Dispatcher Semantics
- Request mode is resolved in `src/pipelines/core/pipeline-routing.ts`.
- Omitted mode defaults to `balanced_v7`.
- `balanced_v6` resolves to its own explicit handler module (`src/pipelines/versions/balanced-v6`).

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

