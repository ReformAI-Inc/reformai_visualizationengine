# Agent Handoff
**Last Updated:** 2026-06-11

## Current Snapshot
The structural cleanup pass is complete. The repo now follows a clear backend responsibility model:
- `transport`
- `pipelines`
- `prompts`
- `guardrails`
- `models`
- `catalog`
- `shared`

## What Changed Most Recently
0. `balanced_v8` (catalogue-first pipeline) shipped: handler at `pipelines/versions/balanced-v8/`,
   prompts at `prompts/balanced_v8/`, mode registered in routing, dispatcher, request schema,
   and the sandbox UI. V7 remains the canonical default; V8 regression is pending.
   See `docs/IMPLEMENTATION_PLAN.md` for the active execution backlog.
1. Backend source folders were reorganized into the ownership model above.
2. Pipeline versions were normalized under `pipelines/versions/`:
   - `balanced-v5`
   - `balanced-v6`
   - `balanced-v7`
   - `balanced-v8`
3. `balanced_v6` now has an explicit handler module (`balanced-v6/index.ts`) and no longer silently resolves to V5 in routing.
4. Contract tests were updated to reflect explicit V6 behavior.
5. README/docs were updated for new request flow and structure.
6. Generated legacy test build output moved to `archive/legacy-snapshots/`.

## Where to Start as Next Engineer
1. Read `docs/PLATFORM_STATUS.md`.
2. Read `apps/vis-service/README.md`.
3. Follow request path from:
   - `transport/controllers/visualization.controller.ts`
   - `pipelines/core/pipeline-dispatcher.ts`
   - `pipelines/versions/<mode>/index.ts`

## Active Work Guidance
- New API/validation logic -> `transport/`
- New pipeline behavior -> `pipelines/versions/`
- New prompt logic -> `prompts/blocks/`
- New structural safety logic -> `guardrails/`
- Model-call behavior -> `models/`
- Shared contracts only when truly reused -> `shared/`

## Quick Validation Commands
- `npm --workspace apps/vis-service run build`
- `npm --workspace apps/vis-service run test:contracts`
- `npm --workspace apps/web-sandbox run build`
