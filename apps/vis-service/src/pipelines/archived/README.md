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
| `baseline_original` | `pipelines/legacy-services/baseline/geminiService.ts` | Frozen — the regression gate's fixed visual anchor. Do not modify. Still hardcodes `gemini-2.5-flash-image`, which was shut down 2026-10-02, so it no longer generates; the gate needs a re-pointed or re-frozen anchor. |
| `balanced_v5` | `pipelines/versions/balanced-v5/index.ts` | Frozen baseline; also serves the `balanced_v6` alias (catalogue flows) |
| `balanced_v6` | alias → `balanced_v5` (`pipeline-routing.ts` HANDLER_ALIASES) | Explicit alias |
| `balanced_v7` | `pipelines/versions/balanced-v7/index.ts` | Canonical production pipeline |
| `balanced_v8` | `pipelines/versions/balanced-v8/index.ts` | Demoted; absorbed into the V9 `product_install` profile per `docs/ENGINE_BLUEPRINT.md` §8, then deleted |

## Rules

- Do not modify `legacy-services/baseline/` — it is the gate's ruler.
- Archived pipeline code in `archive/legacy-pipelines/` is reference-only and
  outside the TypeScript build; it is not importable and must never come back.
- New behavior is never a new version fork — see `docs/ENGINE_BLUEPRINT.md`
  (Task Profiles, §8; "never build again" list, §12).
