# Archived Legacy Pipelines (moved 2026-07-02)

Frozen implementations of pipeline versions V1–V4.1 and `improved_current`,
moved here from `apps/vis-service/src/pipelines/legacy-services/` and
`apps/vis-service/src/prompts/` (backlog item 14; review finding F11).

**Why archived:** every one of these hardcodes `gemini-2.5-flash-image`
(shutdown 2026-10-02) with its own `@google/genai` client, so they die at model
EOL regardless. Keeping them compiled meant nine unmaintained SDK clients, nine
API-key checks, and ~4,600 lines of frozen near-duplicate prompt text inside the
production build.

**Contents:**
- `services/{balanced, balanced_v2, balanced_v2_1, balanced_v2_2, balanced_v3_0, balanced_v4_0, balanced_v4_1, improved}` — the handler implementations (mode keys `balanced_v1`…`balanced_v4_1`, `improved_current`)
- `prompts/<same>` — their prompt families (1:1, no cross-imports; verified at move time)

**Rules:**
- Nothing here is imported by the live system; it is outside the TypeScript build.
- Reference-only. Do not fix, do not revive, do not re-import.
- The visual record of these pipelines' behavior is the historical run outputs
  under `runs/` — reproducibility comes from stored briefs/outputs, not from
  keeping dead code compilable (`docs/ENGINE_BLUEPRINT.md`, principle #9).
- `baseline_original` was **not** archived: it remains live in
  `apps/vis-service/src/pipelines/legacy-services/baseline/` as the regression
  gate's fixed visual anchor.
