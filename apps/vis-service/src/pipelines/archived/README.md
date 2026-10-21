# Archived Pipelines

**Updated 2026-07-02:** Legacy pipelines V1–V4.1 and `improved_current` have been
**physically moved** to repo-root `archive/legacy-pipelines/` and their mode keys
removed from the request schema, routing, and dispatcher. They all hardcoded
`gemini-2.5-flash-image` (shutdown 2026-10-02) with their own SDK clients, so they
would have stopped working at model EOL regardless. Historical run outputs under
`runs/` remain the visual record of their behavior.

## Remaining live modes

| Mode key | Handler location | Status |
|---|---|---|
| `baseline_original` | `pipelines/legacy-services/baseline/geminiService.ts` | The original production pipeline: one prompt plus the images, prompt and order frozen. Since 2026-10-15 it calls the environment's model (`IMAGE_MODEL`, 3.1) through the shared image-model client instead of the shut-down `gemini-2.5-flash-image`, so it generates again; selectable with `?mode=baseline_original`. Its renders on 3.1 differ from the old 2.5 gate anchor, which needs re-freezing. Takes `furnitureImage` only, not `productImages`. |
| `balanced_v5` | `pipelines/versions/balanced-v5/index.ts` | Frozen baseline; also serves the `balanced_v6` alias (catalogue flows) |
| `balanced_v6` | alias → `balanced_v5` (`pipeline-routing.ts` HANDLER_ALIASES) | Explicit alias |
| `balanced_v7` | `pipelines/versions/balanced-v7/index.ts` | Canonical production pipeline |
| `balanced_v8` | `pipelines/versions/balanced-v8/index.ts` | Demoted; absorbed into the V9 `product_install` profile per `docs/ENGINE_BLUEPRINT.md` §8, then deleted |

## Rules

- Do not change `legacy-services/baseline/`'s prompt or part order — it is the original production behaviour and the gate's ruler. Only its model call follows the environment.
- Archived pipeline code in `archive/legacy-pipelines/` is reference-only and
  outside the TypeScript build; it is not importable and must never come back.
- New behavior is never a new version fork — see `docs/ENGINE_BLUEPRINT.md`
  (Task Profiles, §8; "never build again" list, §12).
