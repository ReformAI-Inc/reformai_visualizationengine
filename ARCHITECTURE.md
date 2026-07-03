# ReformAI Visualization Engine — Architecture

**Last Updated:** 2026-05-27 (historical record; sections describing v6 handler modules and human-only scoring predate the 2026-06/07 changes)
**Scope:** Complete architectural history from inception through V8. Every major decision, what triggered it, what it solved, and what it deliberately did not solve.

> **2026-07-03:** The forward-looking design authority is now **`docs/ENGINE_BLUEPRINT.md`** (V2 architecture: task profiles, model policy, layered geometry preservation, evaluation platform, ADRs). Current operational truth: `docs/PLATFORM_STATUS.md`. This document remains the historical *why* through V8; where it conflicts with those two (e.g. §8/§11 v6 handler claims, §10 "human scoring is mandatory" — superseded by the automated gate with human adjudication), they win.

For current operational state — active paths, validation commands, deployment topology — see `docs/PLATFORM_STATUS.md`. This document is the *why*. That document is the *what*.

---

## Table of Contents

1. [What This Document Is](#1-what-this-document-is)
2. [The Product Problem](#2-the-product-problem)
3. [The Original System — Baseline](#3-the-original-system--baseline)
4. [Phase 1 Diagnosis — Everything That Was Wrong](#4-phase-1-diagnosis--everything-that-was-wrong)
5. [The Core Architectural Shift](#5-the-core-architectural-shift)
6. [The Constraint Tier System](#6-the-constraint-tier-system)
7. [Image Role Labeling](#7-image-role-labeling)
8. [Version History](#8-version-history)
   - [Baseline](#baseline)
   - [V1 / V2 / V2.1 / V2.2 — Prompt Tuning Family](#v1--v2--v21--v22--prompt-tuning-family)
   - [V3.0 — Structured Prompt Architecture](#v30--structured-prompt-architecture)
   - [V4.0 — The Architectural Pivot](#v40--the-architectural-pivot)
   - [V4.1 — Post-Pivot Hardening](#v41--post-pivot-hardening)
   - [V5.0 — Lean Moodboard System](#v50--lean-moodboard-system)
   - [V5.1 — Prompt Compression](#v51--prompt-compression)
   - [V5.2 — Structural Hardening](#v52--structural-hardening)
   - [V5.2.1 — The Tonal Overlay Fix](#v521--the-tonal-overlay-fix)
   - [V6.0 — Renovation Material Anchors](#v60--renovation-material-anchors)
   - [V7 — Architectural Ground Truth Pipeline](#v7--architectural-ground-truth-pipeline)
   - [V8 — Catalogue-First Pipeline](#v8--catalogue-first-pipeline-service-provider-use-case)
9. [What We Explicitly Chose Not to Build](#9-what-we-explicitly-chose-not-to-build)
10. [Regression and Validation Philosophy](#10-regression-and-validation-philosophy)
11. [Current Source Structure](#11-current-source-structure)
12. [Deployment Topology](#12-deployment-topology)
13. [What Is Next](#13-what-is-next)

---

## 1. What This Document Is

This is the complete architectural record of the ReformAI Visualization Engine. It is written for an engineer who is new to the project and needs to understand not just how the system is built, but *why* it is built that way — what problems drove each decision, what was tried before, what failed, and what was deliberately deferred.

Every major decision in this codebase has a reason. Most of those reasons are the result of running real regression tests against real failure modes and making precise, measured responses. An engineer who reads this document should be able to answer the question "why does it do it this way?" for any part of the system.

**Reading order:**
- Start here for context and history.
- Then `docs/PLATFORM_STATUS.md` for the current active file paths and routing semantics.
- Then `apps/vis-service/README.md` for the request flow and validation commands.

---

## 2. The Product Problem

ReformAI takes a photograph of a room and transforms it into a photorealistic redesign in a selected interior design style. The model is Google Gemini (`gemini-2.5-flash-image`). Inputs include a base room photo, a style preset, optional moodboard reference images, optional user-uploaded furniture items to inject, and a user text request.

The core tension that defines every architectural decision in this project:

**The model is being asked to do two contradictory things simultaneously.** It must transform the room (change materials, furniture, palette, lighting) while also preserving the room (keep the windows, walls, camera angle, and architectural geometry exactly as they are). Style transformation and structural preservation are in permanent conflict. Every version of this system is a progressively more precise answer to the question of how to resolve that conflict reliably.

A secondary tension: the model receives multiple images — a base room, moodboard references, furniture items, a re-anchor copy of the base room — with no inherent mechanism for distinguishing their roles. Without explicit structural guidance, the model treats them all as generation references and mixes their content in unpredictable ways.

These two tensions — constraint conflict and multimodal ambiguity — are the root causes of every failure this system was built to address.

---

## 3. The Original System — Baseline

The baseline system is a minimal Gemini request: one room image, one text prompt, no constraint structure.

The prompt reads roughly as follows: act as an expert interior designer, redesign the room in the requested style, do not change walls or windows, maintain the perspective. It uses `{{PLACEHOLDER}}` substitution for room type, style name, influence instruction, and furniture instruction. There is no constraint hierarchy. There is no image labeling. There is no structural sandwich. Rules are stated as a flat list with no priority order.

The baseline is preserved in the codebase as `baseline_original` and is still callable as a regression anchor. It is not dead code. It is the floor against which every subsequent version is measured.

**What it could do reliably:** Style-only transformations on clean, uncluttered rooms with no furniture injection and no moodboard references. The model understood the basic task.

**What it could not do reliably:** Almost anything involving multiple images, furniture preservation, or strong style pressure against the room's architectural geometry. The flat rule list gave the model no guidance on how to resolve conflicts between instructions.

---

## 4. Phase 1 Diagnosis — Everything That Was Wrong

Before any architectural work began, a full system audit was conducted. Every confirmed failure was documented. This is that list.

**Structural failures:**
- Spatial drift — camera angle, perspective, and room geometry shifted across runs
- Window and background corruption — windows were restyled, replaced, or added when style pressure favored it
- No enforcement of window count immutability

**Multimodal failures:**
- No image role labeling — the model received multiple images with no text identifying what each image represented; it inferred roles from position, which is fragile
- With moodboard images present, furniture images were sometimes interpreted as additional style references rather than items to preserve
- Input ordering was not optimized

**Constraint failures:**
- No constraint resolution rule — when instructions conflicted, the model resolved the conflict non-deterministically
- Style transformation prompt instructed the model to "replace furniture to match the style" — directly contradicting any furniture preservation instruction
- Furniture preservation instruction did not define what "preserve" means — no mention of material, color, finish, silhouette, or design identity
- No negative constraints — nothing prevented the model from substituting a generic version of a furniture item restyled to match the palette

**Reliability failures:**
- No timeout handling
- No retry logic
- Silent failures — no structured error handling
- No output validation

**Evaluation failures:**
- The self-audit block scored style fidelity but had no failure condition for item identity — the model was trained by the prompt to verify style compliance but not furniture preservation

**Root cause statement:** *The system relied entirely on text prompts to enforce constraints, which is insufficient.* This is the sentence that drove every architectural decision that followed.

---

## 5. The Core Architectural Shift

Every version from Baseline through V3.0 operated by tuning a monolithic or two-part text prompt. Rules were accumulated, refined, and restructured within the prompt body. When instructions conflicted, the model's behavior was undefined. The system got better as prompts got better, but it hit a ceiling it could not break through with prompt tuning alone.

V4.0 introduced a fundamentally different approach: **explicit constraint hierarchy**.

Instead of relying on the model to infer priority from text position or phrasing, V4.0 declares a numbered tier system at the top of every request. Tier 1 has the highest priority. Every tier explicitly yields to the tiers above it. When an injected item is present, Tier 2 activates and overrides Tier 4 (style transformation) — explicitly, by name.

**Why this matters:** The model's behavior in conflict cases becomes deterministic by design, not emergent from prompt phrasing. The system also becomes easier to extend: adding a new constraint type means adding a new tier, not rewriting the prompt and hoping the new rule wins the implicit priority contest.

This shift — from prompt tuning to constraint-driven generation — is the architectural turning point of the project. Everything before V4.0 is the tuning era. Everything from V4.0 forward is the constraint era.

---

## 6. The Constraint Tier System

The constraint hierarchy is declared at the top of every request. It is read before all other instructions. Tiers are applied in strict priority order.

| Tier | Name | Status | What It Protects |
|------|------|--------|-----------------|
| 1 | Architectural Constraints | Always active | Wall/floor/ceiling planes, window/door count/geometry/position, camera perspective, built-in fixtures. Nothing may override these. |
| 2 | Injected Item Constraints | Active when a furniture/item image is present | The exact identity of the uploaded item — silhouette, color, material, finish. Overrides Tier 4 (style). Style conflict is resolved through surrounding elements, not by restyling the item. |
| 2B | Renovation Material Anchors | Active when contractor catalogue selections are present | Named surface materials (flooring, walls, countertops, cabinets) from the contractor catalogue. Overrides Tier 4 on the specified surfaces only. |
| 3 | Room Function and Spatial Logic | Always active | Furniture layout must support room function. Spatial relationships must remain plausible and navigable. |
| 4 | Style Transformation | Always active | Apply the selected style through non-anchored furniture, surfaces, and decor. Must not override Tiers 1–2B. |
| 5 | Moodboard Influence | Active when moodboard images are present | Tonal overlay only — palette, light quality, surface finish. It tints the style; it does not compete with it. Does not override Tiers 1–4. |
| 6 | User Text Request | Always active | Honored within the constraints of all tiers above. |

**Why numbered tiers instead of prose rules:** The model is good at following an explicit numbered priority list. It is unreliable at resolving implicit priority from unstructured text. Naming the conflict resolution rule ("Tier 2 overrides Tier 4 explicitly") removes the ambiguity space where failures live.

**Tier 2 vs Tier 2B distinction:** This is important. Tier 2 applies to *injected items* — physical objects uploaded as images, placed into the scene. Tier 2B applies to *renovation surface materials* — flooring, walls, countertops, cabinets specified through the contractor catalogue as text descriptions, no image involved. They use different input mechanisms, different constraint types, and have different compliance measurement approaches. They are separate tiers because conflating them would create ambiguity about which constraint wins when an injected item interacts with an anchored surface.

**How the constraint block is implemented:** `src/prompts/blocks/constraint-hierarchy.ts`. It is a pure function that accepts `injectedItemCount` and `hasRenovationAnchors` and returns the full constraint hierarchy text with the appropriate tiers marked ACTIVE or INACTIVE. The V7 pipeline extends this block with an AGT tier line prepended on top.

---

## 7. Image Role Labeling

Before V4.0, a request with a room image, two moodboard images, and a furniture image contained four images with no text identifying what each one represented. The model had to infer roles from position in the request sequence. This is a structural defect — not a prompt wording problem.

Position-based inference is fragile. With multiple moodboard images present, the furniture item image was sometimes treated as additional style reference. The model has no intrinsic understanding that an image appearing after two moodboard images is something different — it needs to be told explicitly.

V4.0 introduced image role labels: text parts immediately preceding each image that declare its role and behavioral instructions.

| Role | Label | Instructions |
|------|-------|-------------|
| `BASE_ROOM` | `[BASE ROOM IMAGE]` | Architectural reference. Preserve all structural elements exactly. |
| `BASE_ROOM_REANCHOR` | `[BASE ROOM IMAGE — RE-ANCHOR]` | Structural re-anchor for final generation. All transformations must be grounded in this geometry. |
| `MOODBOARD` | `[MOODBOARD REFERENCE N]` | Style inspiration only. Do not preserve, place, or identify specific items from this image. (Pre-V5 label, frozen.) |
| `MOODBOARD_V5` | `[MOODBOARD REFERENCE N]` | Bounded modifier only. Extract abstract tone only — palette, texture quality, lighting. Discard all discrete elements, materials, and forms. (V5+ label.) |
| `INJECTED_ITEM` | `[INJECTED ITEM N]` | Preserve identity exactly as shown in this image. |
| `PREVIOUS_RESULT` | `[PREVIOUS RESULT]` | Prior generation for refinement context. Carry forward preserved elements. Apply requested changes only. |

The V4.x `MOODBOARD` label and the V5+ `MOODBOARD_V5` label are both preserved. The V4 label is frozen and retained for regression integrity — changing it would alter behavior in the historical benchmark modes. The V5 label uses tighter language that restricts the moodboard to abstract tone extraction only, which was necessary to prevent material leakage (see V5.2).

Token cost of labeling is negligible (~15–25 tokens per label) compared to the reliability improvement it produces.

---

## 8. Version History

### Baseline

**Mode:** `baseline_original`
**Template version:** none (unversioned)
**Status:** Frozen. Callable as historical regression anchor.

The original system. Single room image, flat text prompt, no constraint hierarchy, no image labeling, no structural sandwich. Placeholder substitution for room type, style, influence, and furniture. Rules stated as a flat numbered list with no priority.

Reliable for simple style-only transformations on clean rooms. Unreliable for everything else. Preserved exactly as-is — any change would invalidate its use as a regression floor.

---

### V1 / V2 / V2.1 / V2.2 — Prompt Tuning Family

**Modes:** `balanced_v1`, `balanced_v2`, `balanced_v2_1`, `balanced_v2_2`
**Status:** Frozen. Callable as historical benchmark family.

These versions represent the iterative prompt tuning era. Each addressed specific observed failures by adding, rewriting, or reorganizing rules within the prompt body. V2.x sub-versions addressed specific regression failures discovered after V2.0 was promoted.

The core limitation across this entire family: rules competed with each other implicitly. When the style transformation instruction conflicted with the window preservation instruction, the model resolved the conflict based on prompt phrasing and its internal priors — not based on any declared priority. Better phrasing improved results; it could not eliminate the failure class.

These versions are retained as benchmark anchors to measure how far the constraint-era architecture improved over the tuning-era baseline.

---

### V3.0 — Structured Prompt Architecture

**Mode:** `balanced_v3_0`
**Template version:** `3.1`
**Status:** Frozen reference baseline.

V3.0 was the most capable pre-constraint version. It introduced several structural improvements that formed the foundation for V4.0:

- **Two-part prompt structure** — structural part (fixed architectural rules) and style part (template-driven, injected at runtime) as separate text blocks. The structural part is never modified per style or room type. Changes to it require a new template version and behavioral re-validation.
- **Structural sandwich** — the room image appears at both the start and end of the request. The opening copy is the architectural reference; the closing copy is the structural re-anchor to prevent the generation pass from drifting away from the source geometry.
- **Template-driven injection layer** — 14 `{{PLACEHOLDER}}` fields substituted at runtime from the style preset, room type registry, and density block registry. Post-injection validation checks for unresolved placeholders and hard-fails.
- **Density controls** — furniture staging density introduced as an explicit prompt parameter.

**What V3.0 still could not solve:** Anything involving multiple images, furniture identity preservation, or a declared resolution rule for instruction conflicts. These required a structural change, not more prompt tuning — which is why V4.0 is a new pipeline, not an iteration on V3.0.

---

### V4.0 — The Architectural Pivot

**Mode:** `balanced_v4_0`
**Template version:** `4.0`
**Status:** Frozen benchmark.

V4.0 is the turning point. It introduced three systems that are still active in every subsequent version.

**1. The Constraint Hierarchy (described fully in Section 6)**

Tiers 1–5 declared at the top of every request. Priority order explicit and numbered. Conflict resolution deterministic by design.

**2. The Injected Items System**

When a furniture or product image is uploaded, it is no longer just appended to the request with a generic instruction. V4.0 introduces an `InjectedItem` abstraction with explicit identity preservation rules:

- The item's silhouette, color, material, and finish are non-negotiable — they override Tier 4 style transformation
- Conflicts with the active style are resolved through surrounding elements — the style adapts to the item, not the other way around
- Fidelity modes: `preserve` (user-uploaded items, honor identity) vs `exact` (future catalogue items, exact SKU rendering)
- Identity preservation rules name explicitly what "preserve" means — color, material, finish, silhouette — so the model cannot interpret it loosely

V4.0 caps injected items at 1. Multi-item support was scoped for V4.1 but remained deferred (see Section 9).

**3. Image Role Labeling (described fully in Section 7)**

Explicit text labels preceding every image in the request. Roles declared, not inferred.

**Why V4.0 is a new pipeline and not an iteration on V3.0:**
V3.0 still exists and is still callable. V4.0 is a parallel pipeline, not a replacement. This pattern — adding new pipelines as callables rather than replacing existing ones — was established here and carried forward through every subsequent version. It enables controlled regression comparison: any version can be called against any other version on the same input to measure the delta precisely.

---

### V4.1 — Post-Pivot Hardening

**Mode:** `balanced_v4_1`
**Template version:** `4.1`
**Status:** Frozen benchmark.

V4.1 tightened the V4.0 implementation based on post-launch regression findings. Specific constraint language was sharpened; the identity preservation rules were made more explicit. No new architectural systems — this is refinement within the V4.0 framework.

Template version bumped from 4.0 to 4.1 to mark the behavioral change, as required by the project's versioning discipline.

---

### V5.0 — Lean Moodboard System

**Mode:** `balanced_v5`
**Template version:** `5.0` (within `balanced_v5` constants)
**Status:** Frozen benchmark reference.

**What triggered it:** The style influence slider was removed from the product direction. The previous influence system calibrated moodboard weight vs. style preset weight by percentage. When the slider was removed, the moodboard model needed to change: moodboards are always active as bounded modifiers, never as primary style drivers.

**What was built:**

- **Tier 5 rewritten** — from "Applied as directed by the influence setting" to "Apply moodboard influence as a tonal overlay on top of the style — palette, light quality, and surface finish. It tints; it does not compete."
- **Moodboard scope block** — a text part inserted immediately before moodboard images. It specifies exactly what the model is and is not allowed to extract from a moodboard: permitted (palette direction, texture quality, lighting mood), prohibited (discrete objects, specific materials, furniture forms, architectural elements).
- **MOODBOARD_V5 image role label** — new label with tighter language ("bounded modifier only — extract abstract tone only"). The V4.x `MOODBOARD` label is preserved and frozen in all prior pipeline versions.
- **V5 influence statement** — trailing reinforcement block added as a safeguard.

**The design principle:** The moodboard is allowed to *tint* the output — shift the palette slightly warmer or cooler, modulate surface texture quality, adjust the quality of light. It is not allowed to *compete* — to introduce specific furniture forms, override the style preset's material choices, or introduce elements that conflict with the Tier 1–4 constraint stack. The scope block and the label both enforce this boundary.

---

### V5.1 — Prompt Compression

**Mode:** `balanced_v5` (same mode, updated constants)
**Template version:** `5.1`
**Status:** Part of the frozen V5 benchmark.

**What triggered it:** V5.0 added approximately 200 tokens of moodboard machinery on top of V4.1's already-large prompt. Token count matters: a larger prompt costs more per call, and more importantly, a prompt that has grown through accumulation often contains redundancies that create interpretive ambiguity.

**What was built:** A systematic two-pass redundancy audit:

- Pass 1: ~345 words removed (~23%) — redundant sections, restatements of rules already declared in the constraint hierarchy
- Pass 2: ~327 words removed (~14% of remaining) — phrase-level compression across all blocks
- Combined: ~36–40% reduction vs V5.0/V4.1
- No behavioral changes. All constraint coverage, tier hierarchy, placeholder inventory, and injection logic unchanged.

**Why compression is an architectural act, not just cleanup:** Redundant rules don't help. When the same rule is stated three times in different sections, the model doesn't enforce it three times harder — but the redundancy does create surface area for inconsistency if any one instance uses slightly different language. Removing redundancy tightens the contract between the prompt and the model's behavior.

---

### V5.2 — Structural Hardening

**Mode:** `balanced_v5` (same mode, updated constants)
**Template version:** `5.2`
**Status:** Part of the frozen V5 benchmark.

**What triggered it:** The V5.1 moodboard regression suite (`run_20260429_171148`) revealed two structural violations:

- Industrial × Moodboard A: added windows
- Industrial × Moodboard C: added windows

**Root cause:** Tier 1 declared wall/door/window positions and geometry as immutable but did not explicitly name *window count*. Industrial style has a strong prior toward expansive, light-filled spaces. When moodboard lighting tone was extracted and the model's Industrial style prior was active, it found a loophole: adding windows was not explicitly prohibited by name, only "positions" and "geometry" were frozen. The model justified new windows as consistent with the style.

**What was built:**

Tier 1 updated to include explicit window count immutability. The structural block (`structural.ts`) also updated with the language:

> *"Window and door count, geometry, positions, and sizes [are immutable]."*

> *"Never introduce a new window where none exists in the source."*

This is a case where a precise, observed failure revealed a precise gap in the constraint language, and the fix was equally precise — one sentence that closes exactly that loophole without touching anything else.

**Additional finding:** The moodboard scope block had allowed "surface texture" as a permitted extraction dimension, which was interpreted by the model to include architectural surface treatments (travertine cladding, wood slat walls). This was not intended — "surface texture" was meant to cover tactile quality only (rough/smooth, matte/gloss). Resolved in V5.2.1.

---

### V5.2.1 — The Tonal Overlay Fix

**Mode:** `balanced_v5` (same mode, updated constants)
**Template version:** `5.2.1` (within `balanced_v5` prompt constants)
**Status:** The final frozen V5 benchmark. V6.0 is backward-compatible with this version when no catalogue selections are present.

**What triggered it:** Two issues found after V5.2 regression (`run_20260430_141837`):

1. **Material leakage** — "surface texture" in the moodboard scope block was activating architectural finish extraction. Moodboards with travertine or wood-slat walls caused the model to apply those materials to the room.

2. **Floor-vs-ceiling paradox in Tier 5** — The Tier 5 language simultaneously said "style wins over moodboard" and "moodboard cannot be suppressed by style." These two statements are contradictory. The model's arbitration between them was non-deterministic.

**What was built — two micro-changes, ~25 tokens total:**

1. Scope clarification:
> *"Surface texture refers to tactile quality only (rough/smooth, matte/gloss). It does NOT include material identity or architectural finishes."*

2. Tier 5 overlay statement — replaces the paradox with a clean single rule:
> *"Apply moodboard influence as a tonal overlay on top of the style — palette, light quality, and surface finish. It tints; it does not compete."*

**Why this matters as a case study:** The fix is 25 tokens. The problem it solved — non-deterministic arbitration between contradictory rules — was causing consistent, reproducible failures. This is the discipline that the constraint-era architecture enables: when something fails, the failure is traceable to a specific rule gap, and the fix is targeted and measurable.

---

### V6.0 — Renovation Material Anchors

**Mode:** `balanced_v6`
**Template version:** `6.0.0`
**Status:** Explicit comparison pipeline. Has its own dedicated handler module (`pipelines/versions/balanced-v6/`).

**What triggered it:** The product direction introduced a contractor catalogue feature. Service providers (contractors, designers) can specify the exact renovation materials they supply — flooring, wall finishes, countertops, cabinets — and have those materials appear in the generated visualization. This is a commercial feature: a contractor shows a homeowner what their renovation will look like using the contractor's actual catalogue.

**What was built:**

- **Tier 2B: Renovation Material Anchors** — a new constraint tier inserted between Tier 2 (injected items) and Tier 3 (room function). When active, it declares named surface materials as non-negotiable overrides of Tier 4 style transformation on the specified surfaces only.
- **Contractor catalogue** — in-memory registry keyed by `contractorId`. Items have a `promptDescription` field (model-ready text), an `active` flag, and a `contractorVisible` flag.
- **Multi-tenant isolation** — `contractorId` is resolved from the `X-Contractor-Id` request header only, never from the request body. Cross-contractor item access returns a 400.
- **`/api/catalogue` endpoint** — `GET /api/catalogue` with `X-Contractor-Id` header returns the contractor's active, contractor-visible items.
- **Backward compatibility guarantee** — when `renovationSelectionIds` is absent or `contractorId` is missing, all V6 code paths are skipped entirely. Output is bit-identical to V5.2.1.

**Tier 2B prompt block structure:**
When active, the block contains: a compliance declaration, a visibility gate (do not apply the anchor if the surface is not visible in the source image — do not hallucinate it), the list of active anchor categories, and per-anchor: the exact surface plane to apply to, where the material stops (boundary), and a non-negotiable hard override statement.

**Tier 2 vs Tier 2B — why they are architecturally distinct:**

| Dimension | Tier 2 — Injected Items | Tier 2B — Renovation Anchors |
|-----------|------------------------|------------------------------|
| Input mechanism | Image buffer in multipart request | Catalogue item ID in `renovationSelectionIds` JSON field |
| What reaches the model | Image + metadata text | Prompt text only |
| Constraint type | Identity preservation (exact object) | Surface material specification (named plane) |
| Scope | Specific injected object | Named room surface plane |
| Scaling path | Richer metadata, better photography | Add `imageUrl` to `CatalogueItem` for material reference images (field exists in schema; currently unused) |

**V6 handler note:** At project inception, `balanced_v6` was internally routed to the V5 handler (the V6 additions were implemented inside the V5 pipeline with a mode guard). When the source was reorganized, V6 was given its own explicit handler module. The routing test that expected `balanced_v6 → balanced_v5` was updated to reflect `balanced_v6 → balanced_v6`. Silent aliasing was removed because it caused confusion during debugging and quality review: if `balanced_v6` produced unexpected output, it was not immediately clear whether the failure was in V6 code or inherited from V5 routing.

---

### V7 — Architectural Ground Truth Pipeline

**Mode:** `balanced_v7`
**Template version:** `7.0.0`
**Status:** Canonical active candidate.

**What triggered it:** A specific, reproducible failure class that could not be closed with prompt tuning or constraint language: the Japandi window invention failure.

Japandi as a style has a strong generative prior toward minimalism, clean walls, and abundant natural light. Under heavy Japandi style pressure, the model was inventing windows — adding new glazed openings that did not exist in the source room — and the self-audit block was passing it. The structural constraint in Tier 1 said "do not add windows." The model's Japandi prior said "this room needs more light." When the style pressure was strong enough, the declarative constraint lost.

**The root cause:** Every version through V6.0 enforces architectural constraints *declaratively* — the model is instructed to preserve architecture and asked to self-audit. Declarative enforcement fails when generative style pressure is strong enough to compete with the instruction. The model can simultaneously "know" the rule and violate it when motivated.

**The V7 insight:** Facts are harder to contradict than instructions. If the prompt says "do not add windows," the model can deprioritize that instruction. If the prompt says "this room has exactly 2 windows — EXACTLY 2, measured from the source image," the model is being asked to contradict a stated fact, which requires more motivated reasoning. V7 turns architectural constraints into measured facts.

**The two-call architecture:**

```
Client Request
      │
      ▼
[1] processVisualizationFormData()          — parse multipart, validate
      │
      ▼
[2] extractArchitecturalGroundTruth()       — NEW: fast vision/text model call (~300ms)
      │                                         returns AGT document with per-field confidence
      │                                         on any error: returns FALLBACK_AGT (all low)
      ▼
[3] classifyAGTConfidence()                 — pure function, no model call
      │                                         maps confidence tiers to enforcement strength:
      │                                         high → hard fact ("EXACTLY N")
      │                                         medium → soft advisory ("approximately N")
      │                                         low → suppress (no injection)
      ▼
[4] resolveRenovationSelections()           — unchanged (V6.0 catalogue)
      │
      ▼
[5] buildVisualizationPrompt()              — updated: receives classified AGT
      │                                         injects hard facts, advisories separately
      ▼
[6] Gemini generateContent()                — unchanged single image generation call
      │
      ▼
[7] Return image + debug
         (includes AGT document, confidence tiers per field, hard_fact_fields[], fallback_fields[])
```

**AGT fields extracted:**
- `window_count` — number of windows with per-instance position metadata
- `door_count` — number of doors
- `has_ceiling_fixture` — boolean: does a ceiling light fixture exist
- `has_built_in_niches` — boolean: are there built-in niches or alcoves
- `camera_perspective` — perspective type (straight-on, corner, etc.)

**Why confidence gating is the most important V7 design decision:**

The first V7 draft treated AGT as ground truth: extract a count at high confidence, inject as `EXACTLY N`, enforce. This was correct about the direction but wrong about a new failure mode it created.

The Anti Gravity design critique identified the problem: if the AGT extraction call produces a wrong fact at high confidence, that wrong fact becomes *system-authorized*. The generation model complies with the wrong count. The output is considered structurally correct by the system. The failure is invisible — it passes the self-audit, produces no error, and the wrong number is the one enforced.

A wrong confident extraction is strictly worse than no extraction, because V6.0 prose constraints (which have never been removed) serve as the fallback. Without AGT, the model gets a declarative instruction. With a wrong high-confidence AGT, the model gets a wrong hard fact overriding the instruction.

**Rev 1 solution — AGT as evidence, not truth:**

Field-level confidence tiers gate enforcement strength. High-confidence fields become hard facts. Medium-confidence fields become soft advisory guidance. Low-confidence fields are suppressed entirely — the V6.0 prose constraint serves as fallback.

The calibration is deliberately biased toward medium when uncertain: it is better to emit `approximately 2 windows` than `EXACTLY 2` when the extraction is uncertain. False-medium is recoverable. False-high is an authorized constraint enforcement of a wrong value.

**FALLBACK_AGT** — when the extraction call fails for any reason (timeout, API error, malformed response), the system falls back to FALLBACK_AGT: all fields set to `low` confidence. The full V6.0 behavior applies with no hard facts injected. V7 never blocks generation. The fallback is guaranteed.

**AGT vs style conflict resolution:** V7 includes explicit conflict resolution rules for the case where a style directive pushes against an AGT-identified feature. Priority order: Tier 1 architectural constraints > AGT hard facts > Tier 2/2B item/renovation anchors > style transformation. These rules are deterministic — no model judgment involved in the resolution.

**Expected impact:** ~65–75% elimination of hard architectural failures (invented/removed openings, hallucinated ceiling fixtures, niche replacement, anchor material bleed) relative to V6.0 baseline.

**V7 acceptance target:** ≤2 hard rejections per 12-case regression run; average score ≥4.11.

---

### V8 — Catalogue-First Pipeline (Service Provider Use Case)

**Mode:** `balanced_v8`
**Template version:** `8.0.0`
**Status:** Implemented, pending regression validation.

**What triggered it:** Feedback that V7 lost the clarity of the original baseline prompt. V5 through V7 built progressively complex constraint machinery around a style-first prompt architecture — style drives the brief, and catalogue items are injected as late-stage overrides ("Tier 2B renovation anchors"). This works adequately for the general consumer redesign use case. It is the wrong architecture for the service provider catalogue use case.

**The core problem with applying V7 to catalogue visualization:** When the prompt is style-first, the model reads a detailed aesthetic brief (core materials, color palette, signature elements, staging density, don't rules), then encounters renovation anchors that say "override these specific surfaces." Style pressure competes with the anchor override — the model has already formed a complete design intent, and the catalogue item is asking it to revise part of that intent. This is where "White Oak flooring" becomes "warm wood-toned flooring that harmonizes with the Japandi palette."

**The V8 insight:** For the service provider use case, the catalogue items are not overrides — they are the primary brief. A contractor is not asking the model to redesign a room in a style; they are asking the model to show a client what their room looks like with specific products installed. The role is different. The mission is different. The prompt architecture should reflect that.

**The architectural change:**

V8 uses the same V7 machinery (AGT extraction, confidence gating, conflict clauses, constraint hierarchy, moodboard support). What changes is the prompt's role framing and the position of style within it:

- **V5–V7:** "Act as an expert interior designer → apply this style → [catalogue items override specific surfaces]"
- **V8:** "You are a professional renovation installer → these products are being installed → [style wraps around what the products don't cover]"

The structural prompt is rewritten for contractor/installer framing. The style block is compressed to ambient context — a few lines scoped to unclaimed surfaces — rather than a full style brief with staging density, signature elements, and self-audit. The constraint hierarchy Tier 2B is updated from "catalogue selections override Tier 4 style transformation" to "CATALOGUE ITEMS ARE THE PRIMARY RENDER BRIEF."

**What stays identical to V7:**
- AGT extraction call and confidence gating
- FALLBACK_AGT behavior
- Conflict clauses block
- Moodboard support and influence prompt logic
- Injected item support
- Canonical block sequence (renovation anchors still appear before style block)
- Gemini client

**What changes from V7:**
- `BALANCED_V8_STRUCTURAL_PART` — installer brief framing, catalogue-first principle stated at the top
- `buildV8StylePart()` — compact, two variants: with-style and no-style (clean contemporary fallback)
- `buildConstraintHierarchyBlock()` — Tier 2B relabeled "INSTALLED CATALOGUE PRODUCTS [PRIMARY RENDER BRIEF]"
- `buildVisualizationPrompt()` — no staging density validation, no color_palette/core_materials/signature_elements required; style is optional by name only

**V8 is designed to be called with catalogue selections active.** Without catalogue items, V7 is the more appropriate pipeline — V8's structural part announces a product brief and the absence of products leaves that promise unfulfilled.

**V8 acceptance target:** ≤2 hard rejections per 12-case regression; average catalogue product compliance ≥75% per category.

---

## 9. What We Explicitly Chose Not to Build

Every item below was evaluated, discussed, and deliberately deferred. These are not oversights.

**Window aspect ratio and proportion drift**
Fixing this requires extracting the aspect ratio of each window opening from a single-image perspective projection. The error rate on this extraction is 20–30%. An extraction with that error rate produces wrong numbers more often than it helps. Wrong confident proportions injected as hard facts are strictly worse than no constraint. Deferred to V7.1, contingent on improved extraction reliability.

**Mullion pattern drift (pane count and divider geometry)**
Low hard-rejection frequency from product testing. High extraction complexity (counting panes within an existing window opening requires resolving perspective distortion). The cost-benefit doesn't justify the extraction error risk at this stage. Deferred to V7.1.

**Bathroom and tile-room style under-expression**
Requires room-type surface inventory and per-style surface mapping. Real work with a real implementation cycle. Deprioritized in favor of structural reliability improvements. Deferred to V7.1.

**Camera FOV and perspective recalibration**
Subtle, sub-perceptual to most users. Not currently a hard-rejection trigger in product testing. Deferred to V8, contingent on it surfacing as a meaningful failure category.

**Refinement-pass accumulation drift**
When a generated image is used as the base for a refinement pass, the refinement pass can drift from the original source room. Requires re-anchoring refinement against the original source, not the previous output. Separate fix track from the V7 scope.

**Post-generation structural validation (a third model call)**
Considered for V7. Rejected on call budget grounds: adding a third call would triple latency and cost for the validation step. The decision gate is documented: if production false-hard-fact rate exceeds 5% after V7 ships, add post-validation in V7.1. Until that threshold is crossed, the confidence-gating system is the primary defense.

**Multi-item support (more than 1 injected item)**
V4.0 capped injected items at 1. V4.1 was planned to lift this to 2–3. The capability was never prioritized over the moodboard reliability track (V5.x) and the V6.0 catalogue feature. The data model supports it — `injectedItems` is an array — but the prompt rules and validation for multi-item placement conflict resolution were never built. Deferred indefinitely until a product trigger arrives.

**Catalogue item image references (imageUrl)**
`CatalogueItem` has an `imageUrl` field in the type schema. It is currently unused. The scaling trigger is defined: if countertop or cabinet compliance falls below 75% in the T1–T10 validation matrix, activate `imageUrl` to provide material reference images alongside the text description. The field exists precisely so this can be turned on without a schema change.

**Architectural relationship capture (window spacing, symmetry, relative positions)**
Identified by the Anti Gravity critique as out of AGT scope. Capturing relational geometry from a single perspective image is significantly harder than counting discrete elements. Deferred to V7.1 with an explicit note in the V7 Rev 1 spec.

---

## 10. Regression and Validation Philosophy

**Human scoring is mandatory.** The regression framework generates side-by-side comparison images and a structured output report. Scoring is done by a human reviewer. This is not a limitation — it is a deliberate choice.

Automated scoring of visual output quality is an unsolved problem. Any automated scorer is itself a model with its own failure modes and biases. Using an automated scorer to evaluate a generative model creates a system where the scorer's biases determine what "good" means, independent of actual product quality. Until a scorer can be validated against human judgment at high confidence, human scoring is the only honest measurement.

**The regression matrix is configurable.** Pipeline modes, test cases, and comparison pairs are specified in `tests/regression/config.yaml` (fast canonical) and `tests/regression/config.full_matrix.yaml` (full benchmark matrix). They are not hardcoded. Adding a new test case or changing the comparison pair requires a config change, not a code change.

**Every pipeline version is validated before being considered complete.** A version is *implemented but unvalidated* until a regression run has been executed and the results recorded with: output folder path, report path, win counts, average score comparison, hard rejection count, and a promote/retest/reject recommendation.

**The regression framework is visual, not automated.** Run `python tests/regression/run_regression.py`. It generates outputs. A human reviews them. Results are recorded. That is the process.

**Contract tests are the automated validation layer** — they verify routing semantics, dispatch behavior, AGT confidence classification, and prompt block ordering. They run in milliseconds with no API calls. They are the safety net for behavioral regressions in code, not for output quality.

---

## 11. Current Source Structure

The source was reorganized (post-V7 implementation) into a domain-based folder model. The previous structure mixed concerns — `services/`, `runner/`, `data/`, `request/`, `controllers/` — in ways that created hidden coupling and made it difficult to answer "where does X behavior live?"

The rule for the current structure: **every folder maps to a single responsibility, and that responsibility is obvious from the name.**

```
apps/vis-service/src/
├── transport/          HTTP layer — controllers, multipart parsing, request assembly, schemas
├── pipelines/          Pipeline routing, dispatch, and per-version generation flows
│   ├── core/           Routing logic, dispatcher, canonical composer
│   ├── versions/       Active pipeline version handlers (balanced-v5, v6, v7, v8)
│   └── legacy-services/ Historical geminiService handlers (v1–v4.1, baseline, improved)
├── prompts/            Prompt block builders and version-specific templates
│   └── blocks/         Individual block builders (structural, constraint-hierarchy, AGT, etc.)
├── guardrails/         AGT extraction and confidence classification
├── models/             Gemini client — all provider interaction
├── catalog/            Contractor catalogue registry and resolver
└── shared/             Contracts/types, style/room/density registries, validation utils
```

**Why the old structure was a problem:**
- `src/services/balanced_v5/geminiService.ts` — a service folder containing version-specific pipeline logic mixed with generic service concerns
- `src/runner/` — shared Gemini execution logic isolated from both the services that called it and the models it represented
- `src/data/` — static registries (styles, room types, density blocks) mixed with runtime data concerns
- `src/request/` — request assembly logic with no clear relationship to the transport or pipeline layers

The new structure answers "where does X live?" without needing to know the history:
- Something went wrong in the HTTP layer → `transport/`
- A pipeline is routing to the wrong handler → `pipelines/core/`
- A prompt block is generating wrong text → `prompts/blocks/`
- AGT is extracting wrong values → `guardrails/`
- Gemini API call is failing → `models/`

**Pipeline version identity is explicit, not aliased.** Each active pipeline version (`balanced-v5`, `balanced-v6`, `balanced-v7`) has its own handler module. The routing function (`pipeline-routing.ts`) maps modes to handlers with no silent aliasing. If `balanced_v6` routes to `balanced_v6`, you can read that directly in the routing table. Silent aliasing was removed because it made debugging ambiguous: when `balanced_v6` produced unexpected output, it was not clear whether the behavior was in V6-specific code or inherited through an alias.

**Historical pipeline handlers are preserved in `pipelines/legacy-services/`.** They are not dead code — they are callable benchmark modes and regression anchors. Deleting them would lose the ability to run controlled comparisons against the pre-V4 tuning era.

---

## 12. Deployment Topology

```
Browser
  │
  ▼
Netlify CDN
  │  (serves web-sandbox static build)
  │
  ▼
netlify/functions/api.mjs
  │  (Netlify serverless function — proxies API requests)
  │
  ▼
Cloud Run (Fastify — vis-service)
  │  (auto-deploys from push to main via GitHub Actions)
  │
  ▼
Google Gemini API
  (gemini-2.5-flash for AGT extraction, gemini-2.5-flash-image for generation)
```

**Why this stack:**
- **Gemini** — the model that produces the best multimodal generation results for this use case. The constraint and guardrail architecture was built around its specific behavior patterns and failure modes. Migrating to a different model would require re-running the full regression history.
- **Fastify** — high-performance Node.js framework; handles multipart form data efficiently for the image-heavy request format.
- **Cloud Run** — serverless container, scales to zero, handles the variable request load without infrastructure management overhead.
- **Netlify** — static hosting with serverless functions; the sandbox UI is a development/QA tool, not a production frontend.

**CI/CD:** Push to `main` triggers automatic Cloud Run deployment via `.github/workflows/deploy-vis-service.yml`. The vis-service is always in sync with `main`.

---

## 13. What Is Next

**V8 regression validation (immediate)**
V8 is implemented and compiles clean. It has not yet been validated against the regression matrix. Until a regression run is executed against catalogue-active test cases and results are recorded, V8 is *implemented but unvalidated*. Acceptance target: ≤2 hard rejections per 12 cases; average catalogue product compliance ≥75% per category.

**V7 regression validation**
V7 is implemented and its contract tests pass. It has not yet been validated against the full regression matrix. Until `python tests/regression/run_regression.py` is run against the 12-case benchmark and the results are recorded, V7 is *implemented but unvalidated* per the project's mandatory regression process. The acceptance target is ≤2 hard rejections per 12 cases; average score ≥4.11.

**V7.1 — Architectural relationship capture**
The AGT system extracts discrete counts (windows, doors) but not relational geometry (window spacing, symmetry, relative positions between openings). Capturing relational geometry from a single perspective image is significantly harder. V7.1 is the planned home for this work, contingent on it surfacing as a meaningful failure category in V7 production data.

**V7.1 — Window aspect ratio and mullion patterns**
Deferred from V7 due to extraction error rate. V7.1 trigger: improved single-image perspective projection accuracy that reduces false-high rate below the threshold where wrong facts become worse than no facts.

**V7.1 — Post-generation structural validation**
The decision gate: if production false-hard-fact rate exceeds 5% after V7 ships, add a post-generation validation call as a third model call. This was consciously not added in V7 to avoid tripling latency for a failure mode that may be rare in practice.

**Contractor catalogue scaling**
`CatalogueItem.imageUrl` exists in the schema but is unused. Activation trigger: if countertop or cabinet compliance falls below 75% in the T1–T10 validation matrix, add material reference images to the catalogue items to improve visual compliance.

**Multi-item injection**
The data model supports it. The prompt rules for multi-item placement conflict resolution were never built. Deferred until a product trigger arrives.

---

*For current active paths, routing semantics, and validation commands: `docs/PLATFORM_STATUS.md`.*
*For where to put new code: `docs/DEVELOPMENT_GUIDE.md`.*
*For the V7 confidence-gating spec in full detail: `docs/reference-documents/V7_IMPLEMENTATION_SPEC_REV1.md`.*
