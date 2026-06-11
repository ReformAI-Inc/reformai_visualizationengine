# ReformAI Visualization Engine — Implementation Plan

**Date:** 2026-06-11
**Prepared by:** Architecture review (Claude, VP Engineering / Principal Architect framing)
**Companion docs:** `docs/MODEL_REVIEW_PROMPT.md` (review charter), `ARCHITECTURE.md` (history), `docs/PLATFORM_STATUS.md` (runtime truth)

**Constraint frame:** small team, live production users, hard deadline (**Gemini 2.5 Flash Image sunsets October 2, 2026**), no rewrites.

**Operating thesis:** the bottleneck is measurement, not prompts. Every initiative below either builds the feedback loop or depends on it.

---

## 1. Executive Recommendation

| # | Initiative | Impact | Effort | Depends on |
|---|---|---|---|---|
| 1 | **Hygiene sweep** — fix V8 reachability, commit sandbox wiring, sync docs, delete the v6 phantom | Low direct, high trust: makes the repo's stated truth equal its actual truth before anything else is built on it | XS (hours) | — |
| 2 | **Evaluation gate** — promote the existing Python LLM-judge harness into a scriptable pass/fail gate with a canonical case set and trend ledger | The force multiplier; nothing else can be *proven* without it | M (days) | 1 |
| 3 | **AGT post-generation verification + bounded retry** — close the guardrail loop: re-extract AGT from the output, diff vs. input, retry on hard violations | Largest direct quality gain per line of code (~200–300 lines on existing `extract.ts`) | M (days) | 1 (helped by 2 for measuring its effect) |
| 4 | **Provider abstraction + Gemini 3.x migration** — generalize `callGemini()` → `callImageModel()`, add `gemini-3.1-flash-image` as a routable mode, regression-test, promote | Existential — the current model dies Oct 2 | M (days, plus regression cycles) | 2 (must not migrate blind), 3 (verification catches behavior shifts) |
| 5 | **Task-profile routing (V9 as composition, not a fork)** — intent classifier → task profile → block composer | 15–30% fewer scope-bleed failures on scoped/catalogue requests | L (1–2 weeks) | 2, 4 |

Strict execution order: **1 → 2 → 3 → 4 → 5.** Items 2 and 3 can overlap once 1 lands; item 5 does not start before 4 is promoted.

---

## 2. Implementation Sequence

### Step 1 — Hygiene sweep
- **Objective:** repo truth = stated truth; V8 actually callable over HTTP.
- **Why first:** everything later edits these same files; building on uncommitted/contradictory state multiplies merge pain and confuses any agent (human or Claude) reading the docs.
- **Files:**
  - `apps/vis-service/src/transport/schemas/visualization.schema.ts` — add `balanced_v8` to the mode enum (currently dispatchable but rejected by Zod)
  - `apps/web-sandbox/src/features/visualization-playground/App.jsx` — commit the existing uncommitted V8 wiring
  - `docs/PLATFORM_STATUS.md`, `docs/CURRENT_STATE.md`, `docs/AGENT_HANDOFF.md`, both READMEs — add V8 row/paths per PLATFORM_STATUS §6's own drift rule
  - `pipelines/versions/balanced-v6/index.ts` — replace the 17-line relabel-wrapper with an explicit dispatcher alias, or keep but document it as an alias (pick one; stop pretending it's a pipeline)
- **Expected change size:** < 60 lines plus doc edits.
- **Validation:** `npm --workspace apps/vis-service run build` + `npm run test:contracts` (13/13 must stay green — note one contract asserts v6 resolves to its own handler; update the assertion if you alias), plus one live `POST /generate-visualization?mode=balanced_v8` through the schema.
- **Rollback:** single revert commit; no data or behavior migration.

### Step 2 — Evaluation gate
- **Objective:** one command answers "did quality regress?" with a machine-readable PASS/FAIL.
- **Why before AGT/migration:** you cannot demonstrate that verification helps, or that Gemini 3.x is safe, without a fixed yardstick. V7 shipping with regression "still pending" is the failure mode this prevents.
- **Files:** `tests/regression/run_regression.py` (already does generation + Claude-judge scoring — extend, don't rewrite), new `tests/regression/gate.py`, new `tests/regression/config.gate.yaml` (canonical set), new `runs/ledger.jsonl` (append-only trend record), optional CI workflow.
- **Expected changes:** canonical case set (~10–12 cases: 4 fixture rooms in `fixtures/` × core scenarios incl. moodboard + furniture injection + catalogue); `gate.py` parses `manifest.json`, applies thresholds (any hard rejection = FAIL; weighted-score drop > 0.25 vs. ledger baseline = FAIL), exits non-zero, appends to ledger.
- **Validation:** run the gate twice on unchanged `balanced_v7` — must PASS deterministically enough to be usable (if judge variance flips results, add per-case best-of-2 judging before trusting it). Then immediately pay down debt: run the **pending V7 and V8 regressions** and record results in the ledger.
- **Rollback:** none needed — additive tooling, no production-path changes.

### Step 3 — AGT verification + retry
- **Objective:** "hard" AGT facts become enforced, not hoped-for.
- **Why now:** highest quality-per-effort in the system; also the safety net during model migration (catches behavioral drift on the new model automatically).
- **Files:** `guardrails/extract.ts` (parameterize so it can run on a generated image), new `guardrails/verify.ts`, `pipelines/versions/balanced-v7/index.ts` and `balanced-v8/index.ts` (wrap generation), `shared/types/agt.ts` (verdict types), debug metadata surfaced in `App.jsx` MetaPanel.
- **Expected changes:** ~250–350 lines. Full design in §4.
- **Validation:** contract tests for the diff logic (pure function, covered in `contracts/runContracts.ts` style); then an eval-gate run with verification ON vs OFF — hard-rejection count must drop, and the ledger proves it.
- **Rollback:** ship behind a per-request flag (`verifyAGT=true` default off → flip default after gate evidence). Rollback = flip the default back.
- **Deployment caveat:** the Netlify proxy has a **26 s function timeout** (`netlify.toml`); one retry ≈ +1 extraction (~2–3 s) + 1 generation (~5–10 s). Budget max **one** retry in the synchronous path, and raise the timeout or return the best-effort image with a `verificationFailed` flag rather than 504ing.

### Step 4 — Provider abstraction + Gemini 3.x migration
- **Objective:** survive Oct 2 with measured, not assumed, quality parity.
- **Why fourth:** migrating without Steps 2–3 means re-tuning eight prompt families blind, on a deadline.
- **Files:** `models/gemini.client.ts` → `models/image-model.client.ts` (+ thin `providers/gemini.ts`), `shared/generation-parts.ts` (neutral request type), `pipelines/core/pipeline-dispatcher.ts` (mode → model binding), `guardrails/extract.ts` (extraction model constant likewise routed).
- **Expected changes:** design in §6. Then: add `balanced_v7_nb2` (V7 prompts on `gemini-3.1-flash-image`) as a routable comparison mode; run the gate head-to-head; fix deltas; promote NB2 as default; keep 2.5-flash routable until sunset, then remove.
- **Validation:** gate PASS on the new model for the canonical set; AGT-verification failure rate on NB2 ≤ 2.5-flash baseline.
- **Rollback:** default-mode constant flip in `pipeline-routing.ts` (until Oct 2 removes the floor).

### Step 5 — Task-profile routing (V9)
- **Objective:** scoped requests (flooring swap, lighting redesign) get scoped constraint profiles instead of the full-room-redesign prompt.
- **Why last:** it multiplies surface area; only safe once the gate can measure it and the model is stable.
- **Files/design:** §5 below.
- **Validation:** gate extended with scoped-request cases; scope-bleed (changes outside the requested scope) measured by the judge rubric + AGT diff.
- **Rollback:** profiles are data; the default profile reproduces V8 behavior exactly, so rollback = always selecting the default profile.

---

## 3. Evaluation System Design

**Principle:** the repo already owns 80% of this — `run_regression.py` has the 8-dimension rubric, 10 hard-rejection rules, and weighted scoring. The work is *hardening and automating*, not inventing.

**Three measurement layers:**

| Layer | What | How | Automated? |
|---|---|---|---|
| L1 — Deterministic | Architectural preservation | AGT diff (window/door counts, perspective) input vs output, via flash-tier text extraction; optionally edge-map IoU (canny on input vs output, masked to wall/window regions) as a cheap geometry signal | **Fully** — runs on every production request once Step 3 lands |
| L2 — VLM judge | Style adherence, furniture preservation, scope compliance, staging, defects | Existing Claude-judge rubric, extended with: `furniture_fidelity` (given the injected product image: same item? material/silhouette/color preserved? score 1–5) and `scope_compliance` (did anything outside the requested scope change? 1–5) | **Automated in the gate**, sampled in production (e.g. 5% of traffic) |
| L3 — Human | Aesthetic quality, "would a customer accept this," judge calibration | Existing `report.html` side-by-side review; humans audit ~20 judge verdicts per release to keep the judge honest | Manual, lightweight |

**Scoring system** (extends current weights):

```
StructuralScore  = mean(structural_fidelity, window_exterior_preservation)   # gated by L1: any AGT hard-fact mismatch → 0
StyleScore       = mean(style_fidelity, material_hierarchy, design_fidelity)
ScopeScore       = scope_compliance                                           # new dimension
FurnitureScore   = furniture_fidelity (only when items injected)
Overall          = 0.35·Structural + 0.25·Style + 0.20·Scope + 0.10·Furniture + 0.10·(staging+functional+defects)/3

HARD FAIL (overrides Overall): any of the 10 existing hard-rejection rules, OR L1 AGT mismatch on a 'hard'-tier fact.
GATE: FAIL if any canonical case hard-fails, or median Overall drops >0.25 vs ledger baseline.
```

**Implementation details:**
- Judge prompts live next to the harness (`tests/regression/judge_prompts/`) and are versioned — a judge-prompt change invalidates ledger comparability, so the ledger records `judge_version`.
- Reduce judge variance with temperature 0 + structured-output scoring + best-of-2 on disagreement > 1 point.
- Keep using the Anthropic API for judging (independent from the generation vendor — don't let Gemini grade Gemini).

---

## 4. AGT Verification Design

**Flow:**

```
Input image ──► AGT Extraction (exists: guardrails/extract.ts)
                    │  facts + confidence → classify.ts → tiers (exists)
                    ▼
              Generation (callImageModel)
                    ▼
              AGT Verification (NEW: guardrails/verify.ts)
                    │  re-extract AGT from OUTPUT image
                    │  diff vs input AGT, hard-tier facts only
                    ▼
          pass ──► return image (+ verification metadata)
          fail ──► Retry (max 1 in sync path):
                    re-generate with violation feedback appended
                    re-verify → pass? return : return best attempt
                                              + verificationFailed flag
```

**Verification rules** (diff only what `classify.ts` marked `hard` — never block on `advisory`/`suppressed`):
- `window_count` output ≠ input → **violation** (the #1 documented failure mode)
- `door_count` mismatch → violation
- `camera_perspective` category change → violation
- `has_ceiling_fixture` / `has_built_in_niches`: violation only if *removed* when input=true (additions are often style-legitimate — start lenient)
- Extraction failure on the output image → treat as **inconclusive, pass-with-flag** (never block users on guardrail infra errors)

**Thresholds & retry logic:** any hard violation triggers retry; retry prompt = original parts + an appended correction block, e.g.:

> `VIOLATION FEEDBACK: Your previous output contained 3 windows; the source room has exactly 2 (positions: <instances from input AGT>). Regenerate with exactly 2 windows in their original positions.`

One retry max synchronously (Netlify 26 s ceiling). After retry, return the better attempt (fewer violations) with metadata `{verified: false, violations: [...]}` so the sandbox/product can badge it.

**Pseudo-code (`guardrails/verify.ts` + pipeline wrap):**

```ts
export function diffAGT(input: AGTResult, output: AGTResult): Violation[] {
  const v: Violation[] = [];
  for (const field of HARD_FIELDS(input)) {            // tiers from classify.ts
    if (!matches(input[field], output[field])) v.push({ field, expected: input[field], got: output[field] });
  }
  return v;
}

export async function generateVerified(parts: GeminiPart[], inputAGT: AGTResult, opts: {maxRetries: 1}) {
  let result = await callImageModel(parts);
  let violations = diffAGT(inputAGT, await extractAGT(result.image).catch(() => null) ?? PASS_INCONCLUSIVE);
  for (let i = 0; i < opts.maxRetries && violations.length; i++) {
    result = await callImageModel([...parts, textPart(buildViolationFeedback(violations, inputAGT))]);
    violations = diffAGT(inputAGT, await extractAGT(result.image).catch(() => null) ?? PASS_INCONCLUSIVE);
  }
  return { ...result, verification: { verified: violations.length === 0, violations } };
}
```

**Cost:** +1 flash-tier extraction per request (~2–3 s, cheap); retries only on failures — at a 10–15% violation rate, expected marginal generation cost ≈ +10–15%, *falling* as migration to better models lands.

**Effort:** 2–4 days including contract tests — `diffAGT` is a pure function, trivially testable in the existing `runContracts.ts` style.

---

## 5. Task Routing Design (V9)

**Verdict: yes to V9 routing, but as a composition layer — emphatically not a sixth prompt-family tree.** Project history shows persona/wording forks under-deliver while structural changes deliver; the repo already carries 15 prompt folders.

**Architecture:**

```
Request ──► classifyIntent() ──► TaskProfile ──► composePrompt(profile) ──► single V9 pipeline
```

**Routing logic (two stages, cheap first):**
1. Deterministic rules — catalogue selections present? `flooring` category selected → `flooring_replacement`; injected furniture items → `furniture_injection`; no catalogue + style preset only → `full_redesign`.
2. Only when rules are ambiguous, a single cheap text-model call (flash-tier) classifies the free-text request into the enum.
3. Log the chosen profile in debug metadata (extend the existing debug JSON the sandbox already displays).

**Data structure** (in `shared/types/` — it's data, not code):

```ts
interface TaskProfile {
  task: 'full_redesign' | 'flooring_replacement' | 'cabinet_replacement'
      | 'lighting_redesign' | 'furniture_injection' | 'wall_finish';
  transformScope: SurfaceRegion[];        // what MAY change: ['floor']
  lockedScope: SurfaceRegion[] | 'all_except_transform';
  constraintEmphasis: 'geometry' | 'material_fidelity' | 'item_identity';
  personaLine?: string;                   // one sentence, e.g. flooring-installer framing
  agtStrictness: 'standard' | 'strict';   // strict = also verify advisory facts
}
```

**Prompt composition:** new blocks in the existing `prompts/blocks/` layer — `scope-lock.ts` ("ONLY the floor surface may change. Every other surface, object, and fixture must remain pixel-faithful…"), `task-emphasis.ts`, plus the one-line persona. The V9 builder = V8's structural core + AGT blocks + profile-selected blocks. The `full_redesign` profile must reproduce V8 output byte-for-byte (contract-tested) — that's the rollback guarantee.

**Quality gain vs. cost:** real gain concentrated in scoped/catalogue requests (the V8 business case), expected 15–30% scope-bleed reduction, *measured* by the new `scope_compliance` judge dimension plus AGT diff. Maintenance cost stays low because profiles are ~20-line data objects and blocks are unit-tested like the existing 11 block test suites in `prompts/blocks/__tests__/`.

---

## 6. Multi-Model Strategy

**Abstraction layer** — evolve the existing single seam, keep its discipline ("no pipeline imports an SDK directly"):

```
models/
  image-model.client.ts      // callImageModel(request) — the only entry point
  providers/
    gemini.ts                // wraps @google/genai (current callGemini body)
    flux.ts                  // future: BFL/fal — depth-conditioned path
  provider-registry.ts       // modelId -> provider binding
```

```ts
interface ImageGenRequest {
  parts: LabeledPart[];                     // {role: 'base_room'|'moodboard'|'furniture_item'|'instruction', data}
  modelId: string;                          // 'gemini-3.1-flash-image' | 'gemini-3-pro-image' | ...
  options?: { mask?: Buffer; conditioning?: { depth?: Buffer; edges?: Buffer } }; // ignored by providers that can't
}
interface ImageGenResult { image: string; modelId: string; raw?: unknown }

async function callImageModel(req: ImageGenRequest): Promise<ImageGenResult> {
  return providerFor(req.modelId).generate(req);   // registry lookup
}
```

**Key choice:** keep **roles** in the neutral request (`LabeledPart.role`) and let each provider decide how to express them — Gemini 2.5 renders roles as prose labels (current behavior, unchanged); Gemini 3.x maps them to native reference slots (up to 14); FLUX maps them to reference images + conditioning inputs. This is where prompt scaffolding gets *deleted*, per provider capability, instead of accreted.

**Migration strategy:**
1. Mechanical refactor — move `callGemini` body into `providers/gemini.ts`, `callImageModel` delegates; zero behavior change, contracts green.
2. Bind model per pipeline-mode in the dispatcher (default modes stay on 2.5-flash).
3. Add `balanced_v7_nb2` mode → gate head-to-head → promote → sunset 2.5 before Oct 2.
4. Future providers are a new file in `providers/` + a registry entry + a comparison mode. Route the AGT *extraction* model through the same registry (it has its own constant today in `extract.ts`).

**Model landscape context (researched June 2026):**
- `gemini-2.5-flash-image` — **shutdown Oct 2, 2026** (Google deprecations page)
- `gemini-3.1-flash-image` (Nano Banana 2) — GA, official replacement, up to 10 object refs, ~$0.067/img
- `gemini-3-pro-image` (Nano Banana Pro) — GA, #1 on GEditBench v2 and LMArena image-edit, up to 14 refs, partial mask-edit
- FLUX.2 + FLUX Tools (depth/canny conditioning, Fill masks) — the only frontier family with *hard* geometry constraints
- Seedream 4.5 — #2 GEditBench, ~$0.04/edit, cost-tier challenger
- GPT Image 2 — best raw instruction-following but weak visual consistency (scene drift) — wrong trade-off for this product

---

## 7. Technical Debt Reduction

| Action | Target | Specifics |
|---|---|---|
| **Delete** | `pipelines/versions/balanced-v6/index.ts` (17-line phantom) | Replace with explicit dispatcher alias `balanced_v6 → balanced_v5` handler + log label; update the v6 contract assertion accordingly |
| **Delete** | Unused density blocks | The 3 TODO-flagged, unreferenced blocks in `shared/density-blocks.registry.ts` (~half its 107 lines); aspirational dead code |
| **Archive** | `pipelines/legacy-services/` v1–v4_1 + `improved/` (~1,100 lines) and their prompt families `prompts/balanced_v2*`, `v3_0`, `v4_0`, `v4_1`, `improved` (~3,500 lines) | Move to repo-root `archive/` outside `tsconfig` include; remove modes from schema/dispatcher; keep `baseline_original` + `balanced_v5` in-tree as the only live comparison anchors. Check `tests/regression/config.full_matrix.yaml` references before removing modes — change config and modes together |
| **Freeze** | `balanced_v5`, `balanced_v7` prompt families | Canonical anchors; changes only via new versions/profiles |
| **Consolidate** | `tests/visualization_ab/` and `tests/bedroom_regression/` (output-only, no runners) | Fold fixtures/outputs into `tests/regression/` archives; one harness, one ledger. Also: `App.jsx` (877-line monolith) — extract mode-selection and request-building into modules *opportunistically* when V9 UI work touches it, not as a standalone project |

**Sequencing note:** archive work lands **after** Step 2, because the gate's full-matrix config references legacy modes.

---

## 8. Execution Backlog

| # | Title | Description | Pri | Impact | Complexity | Blocked by |
|---|---|---|---|---|---|---|
| 1 | V8 schema fix | Add `balanced_v8` to `visualization.schema.ts` enum | P0 | Unblocks V8 entirely | XS | — |
| 2 | Commit sandbox V8 wiring | Commit `App.jsx` uncommitted changes | P0 | Repo integrity | XS | — |
| 3 | Doc sync | V8 rows/paths in PLATFORM_STATUS, CURRENT_STATE, AGENT_HANDOFF, READMEs | P0 | Truthful docs | XS | 1 |
| 4 | Resolve v6 phantom | Alias-or-document decision + contract update | P1 | Removes confusion | XS | — |
| 5 | Canonical gate case set | `config.gate.yaml`, ~10–12 cases over `fixtures/` | P0 | Eval foundation | S | — |
| 6 | Gate runner + ledger | `gate.py` PASS/FAIL + `runs/ledger.jsonl`, judge versioning, variance control | P0 | The feedback loop | M | 5 |
| 7 | Run pending V7/V8 regressions | Execute gate on v7 and v8; record baselines | P0 | Pays the open debt; baselines for everything after | S | 6 |
| 8 | `diffAGT` + verify module | `guardrails/verify.ts` pure diff + contract tests | P0 | Core of enforcement | S | — |
| 9 | Verified generation wrapper | Retry-once flow in v7/v8 pipelines, behind flag, debug metadata | P0 | Direct quality gain | M | 8 |
| 10 | Verify ON/OFF gate run; flip default | Evidence, then enable | P0 | Proves #9 | S | 6, 9 |
| 11 | Provider abstraction refactor | `callImageModel` + `providers/gemini.ts`, zero behavior change | P0 | Migration prerequisite | S | — |
| 12 | NB2 comparison mode + gate run | `balanced_v7_nb2` on `gemini-3.1-flash-image`; head-to-head; fix deltas | P0 | The migration itself | M | 6, 10, 11 |
| 13 | Promote NB2 default; sunset 2.5 | Default flip, then remove old model pre-Oct 2 | P0 | Deadline compliance | S | 12 |
| 14 | Archive legacy pipelines/prompts | Per §7, with regression-config update | P1 | −4,500 lines surface area | M | 6 |
| 15 | TaskProfile types + intent rules | Data structures + deterministic classifier | P1 | V9 foundation | S | 13 |
| 16 | Scope-lock blocks + V9 composer | New blocks, profile-driven composition, V8-parity contract | P1 | Scope-bleed reduction | M | 15 |
| 17 | Scoped-request gate cases + V9 eval | Extend rubric with `scope_compliance`, `furniture_fidelity`; measure V9 | P1 | Proves V9 | M | 16 |
| 18 | NB Pro hero tier | `gemini-3-pro-image` for final renders; mask-edit trial | P2 | Quality ceiling | M | 13 |
| 19 | FLUX depth-conditioned spike | Provider + conditioning path as comparison mode | P2 | Hard-geometry option | L | 11, 6 |
| 20 | App.jsx decomposition | Extract modules opportunistically during V9 UI work | P2 | Maintainability | M | 16 |

**Must do now:** 1–13. **Should do next:** 14–17. **Nice to have later:** 18–20.

---

## 9. Claude Code Execution Plan

**SAFE TO AUTO-IMPLEMENT** (mechanical, contract-protected, trivially reversible — one PR each unless noted):
- Backlog 1–3 (schema line, commit wiring, doc sync) — one combined PR
- Backlog 8 (`diffAGT` pure function + tests)
- Backlog 11 (provider refactor — zero-behavior-change, contracts prove it)
- Backlog 5 (gate config authoring)
- Ledger/gate plumbing in 6 (the parsing/threshold code, not the threshold *values*)

**IMPLEMENT THEN REVIEW** (correct shape is clear; a human must inspect outcomes before they take effect):
- Backlog 4 (v6 alias — tiny, but it changes a documented governance contract)
- Backlog 9 (verification wrapper — review the retry-feedback prompt wording and latency numbers before flag-flip)
- Backlog 7, 10, 12 (gate runs — Claude executes and produces the report; **a human reads the images/report before any promotion**)
- Backlog 14 (archive sweep — review the build/config diff; deletion-adjacent)
- Backlog 15–16 (V9 composer — review the new block wording; prompt text is product surface)

**HUMAN DECISION REQUIRED** (judgment calls that gate everything downstream):
- Gate threshold values and what counts as the canonical case set (this *defines* quality for the company)
- Flipping verification default ON (cost/latency trade-off with the 26 s Netlify ceiling)
- Promoting NB2 to default and sunsetting 2.5-flash (production model change)
- Whether `full_redesign` traffic moves to V9 or V9 serves only scoped requests initially
- Approving the FLUX spike (new vendor, new cost line)

**PR partitioning rule:** never mix a refactor PR with a behavior PR — e.g. backlog 11 (refactor) and 12 (new mode) are separate PRs even though they touch the same files; 9 (wrapper, flag-off) and 10 (flag-on) are separate so the flip is a one-line revert.

---

## 10. Final Recommendation — only three improvements before the migration

1. **The evaluation gate (backlog 5–7).** Without it, the migration is a guess performed on a deadline, the pending V7/V8 regression debt stays unpaid, and you cannot tell whether anything else on this list worked. It converts the migration from a risk into a measured comparison. Everything in this plan is leverage on this item.

2. **AGT post-generation verification (backlog 8–10).** Cheapest large quality win in the codebase (~300 lines, infrastructure half-built), directly targets the #1 documented failure mode (window corruption), and acts as a *runtime tripwire during the model swap*: if Gemini 3.1 behaves differently on structural preservation, verification catches it in production on day one.

3. **Provider abstraction + NB2 comparison mode (backlog 11–13).** The actual migration, done the way this repo already knows how to do things: as one more routable mode, gated head-to-head against the incumbent, promoted on evidence. Leaves the multi-model seam every future initiative (Pro hero tier, FLUX conditioning, Seedream cost tier) plugs into.

**Why this trio:** each removes a different class of blindness — **historical** (no baselines), **runtime** (no output checking), **forward** (no safe path to the next model). Task routing, archiving, and UI cleanup are all genuinely valuable, but every one is executed better, cheaper, and more safely *after* these three exist — and none of them matters if the engine is standing on a model that turns off on October 2.

---

## Progress Tracking

| Backlog # | Status | PR / Commit | Notes |
|---|---|---|---|
| 1 | **Done** (2026-06-11) | hygiene sweep commit | `balanced_v8` added to Zod enum; schema parse verified |
| 2 | **Done** (2026-06-11) | hygiene sweep commit | Sandbox V8 wiring committed |
| 3 | **Done** (2026-06-11) | hygiene sweep commit | PLATFORM_STATUS, CURRENT_STATE, AGENT_HANDOFF, both READMEs synced |
| 4 | **Done** (2026-06-11) | v6 alias commit | Wrapper deleted; explicit `HANDLER_ALIASES` in routing; debug records alias; contracts updated |
| 5 | **Done** (2026-06-11) | gate commit | `config.gate.yaml` (12 canonical cases, thresholds, judge/gate versioning) — case set pending human sign-off before first paid run |
| 6 | **Done** (2026-06-11) | gate commit | `gate.py` + `runs/ledger.jsonl`; validated dry-run against recorded May manifests (FAIL on real hard rejection, PASS on clean run, baseline pickup works) |
| 7 | **Done** (2026-06-11) | runs 003712 + 103411 | V7 baseline: PASS 12/12, 0 hard rejections, median 4.43 (accepted baseline in ledger). V8: PASS on hard rejections (0) but candidate median 3.98 vs baseline-pipeline 4.53 in the same run — V8 systematically under-transforms style in style-only (non-catalogue) flows. Note: Anthropic credits ran out mid-judging; 3 V7 cases + all 12 V8 cases were judged in-session by Claude Opus 4.8 with the identical rubric (marked `judge: session-claude-opus-4.8` in manifests). Re-judge via API for confirmation once credits are topped up if desired. |
| 8 | **Done** (2026-06-11) | verify commit | `guardrails/verify.ts` (pure `diffAGT` + `buildViolationFeedback`); 6 new contracts, suite now 19/19 |
| 9 | **Done** (2026-06-11) | verified-generation commit | `guardrails/verified-generation.ts` wired into V7+V8 behind `verifyAGT` request flag (default OFF); harness can enable via `request_fields` in gate config; debug payload carries `agtVerification` |
| 10 | Not started | | |
| 11 | Not started | | |
| 12 | Not started | | |
| 13 | Not started | | |
| 14 | Not started | | |
| 15 | Not started | | |
| 16 | Not started | | |
| 17 | Not started | | |
| 18 | Not started | | |
| 19 | Not started | | |
| 20 | Not started | | |
