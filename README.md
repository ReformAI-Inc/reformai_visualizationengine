# ReformAI Visualization Engine

An AI visualization platform that transforms room photos into styled interior designs using Google Gemini.

## Quick Start

### 1. Prerequisites
- Node.js v20+
- Google Gemini API key

### 2. Install
```bash
npm install
```

### 3. Environment
Copy `.env.example` to `.env` and set `API_KEY`.

### 4. Run locally
```bash
npm run dev
```
- Frontend: `http://localhost:3333`
- Backend: `http://localhost:8080`

## Product/Governance Model
- Canonical active candidate: `balanced_v7`
- Catalogue-first comparison candidate: `balanced_v8` (regression pending)
- Explicit comparison mode: `balanced_v6` (separate pipeline module)
- Historical/frozen benchmark modes remain available for comparison workflows.
- Historical anchor: `baseline_original`

Authoritative lifecycle/governance source:
- `docs/PLATFORM_STATUS.md`

## Repository Structure
- `apps/web-sandbox`: comparison-oriented sandbox UI
- `apps/vis-service`: backend service
  - `src/transport`: Fastify controllers, request parsing, validation schemas
  - `src/pipelines`: pipeline routing and per-version generation flows
  - `src/prompts`: prompt blocks/templates/composition helpers
  - `src/guardrails`: AGT extraction/classification and structural constraints
  - `src/models`: model-provider integration (Gemini client)
  - `src/catalog`: contractor catalogue registry and resolver
  - `src/shared`: shared backend contracts, registries, and validation
- `docs`: architecture and operating notes
- `tests`: regression and benchmarking workflows
- `archive/legacy-snapshots`: non-runtime historical/generated artifacts

## Request Flow (Simple)
1. `POST /generate-visualization` enters `transport`.
2. Multipart + fields are validated and assembled into a typed request.
3. `pipelines/core/pipeline-dispatcher` routes by `mode` (defaults to `balanced_v7`).
4. Selected pipeline composes prompt blocks from `prompts`, applies guardrail context from `guardrails`, and calls model client in `models`.
5. Response returns image + debug metadata to the sandbox.

## Validation Workflows
### vis-service contract checks (spawn-free)
```bash
cd apps/vis-service
npm run test:contracts
```

### Regression preflight profiles (Node, no Python required)
```bash
npm run regression:preflight
npm run regression:preflight:full
```

- `regression:preflight` validates fast canonical profile (`tests/regression/config.yaml`) in non-strict mode.
- `regression:preflight:full` validates full product-evolution benchmark matrix (`tests/regression/config.full_matrix.yaml`) in strict mode.

## Architecture
See:
- `ARCHITECTURE.md`
- `docs/PLATFORM_STATUS.md`
- `tests/regression/README.md`

## Deployment
Backend deploys to Cloud Run; frontend deploys to Netlify.

## License
Internal Use Only - ReformAI
