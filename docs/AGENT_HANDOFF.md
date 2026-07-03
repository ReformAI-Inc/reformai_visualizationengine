# Agent Handoff
**Last Updated:** 2026-07-03

## Read these first
1. `tasks/current-state.md` — where the project stands right now
2. `docs/PLATFORM_STATUS.md` — operational truth (modes, gate, validation)
3. `docs/ENGINE_BLUEPRINT.md` — design authority for all future work
4. Memory: the NB2 gate evidence is COMPLETE and PASSING; the `DEFAULT_IMAGE_MODEL` flip awaits human sign-off. NB2 returns JPEG (old model: PNG) — never assume image mime.

## Current Snapshot (2026-07-03)
Gate 2.0 + judge 2.0 + repeats are live; paid runs executed: V7 baseline PASS (4.15, accepted), Run A NB2 PASS (4.38, 0 rejections), Run B NB2+verify PASS (4.40; verification repaired 2/36 first-attempt violations). Legacy pipelines V1–V4.1/improved archived. Items 2–3 below are historical (2026-06-11); item 3's claim about a `balanced-v6` handler module is **obsolete** — v6 is a routing alias (`HANDLER_ALIASES`), no module exists.

## Previous snapshot (2026-06-11)
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
