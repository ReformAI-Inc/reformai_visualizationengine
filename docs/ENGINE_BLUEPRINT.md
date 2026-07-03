# ReformAI Visualization Engine — Implementation Blueprint (V2 Architecture)

**Status:** Master engineering reference — **Blueprint revision 3** (rev 2: self design-review, §15; rev 3: Production Integration Objective elevated to first-class, per review feedback)
**Date:** 2026-07-02
**Supersedes as design authority:** ARCHITECTURE.md §13 roadmap, IMPLEMENTATION_PLAN.md §5 (V9 sketch)
**Companion documents:** `REPO_REVIEW_AND_REBUILD_PLAN_2026-07-02.md` (findings F1–F24, referenced throughout as "F-numbers"), `PROVIDER_STRATEGY_ASSESSMENT_2026-07-02.md` (provider evidence, referenced as "PSA")
**Governing verdict:** *Optimize, do not rebuild.* This document is the shape the current system evolves into — not a replacement for it.

Every significant change below carries a decision block:
> **Current → Recommended | Justification | Essential or Desirable | Validation**

Changes marked **ESSENTIAL** are required for correctness, the Oct 2 EOL, or measurable quality. Changes marked **DESIRABLE** improve leverage but can be sequenced freely.

---

## 0. Engineering Principles

Ten durable, technology-independent principles. Every future implementation decision should be defensible against this list; a change that violates one requires an ADR (§14) explaining why.

1. **Optimize before rebuilding.** Twice validated: the architecture review and the provider research both found evolution beats replacement. A rebuild proposal carries the burden of proof.
2. **Production-first architecture.** The Visualization Engine exists to power the ReformAI production platform. Research, experimentation, and internal tooling must never compromise the ability to integrate and operate the service in production. Every implementation decision answers the question: *"does this make production integration easier or harder?"* (See "Production Integration Objective" below.)
3. **The evaluation platform is the source of truth. Nothing promotes by argument.** Not by leaderboard, not by demo, not by vendor claim, not by "it looked great in the sandbox." Models, providers, profiles, prompt blocks, extractors — all promote through the gate or not at all.
4. **One pipeline, many behaviors.** Behavior differences are data (profiles, policies, block parameters), never code forks. If a behavior can't be expressed as configuration, question the behavior before questioning the rule.
5. **Structure first.** A structural violation is a *defect* (hard rejection); weak style transformation is a *low score*. The asymmetry is deliberate — V8 proved under-transformation is a real failure mode, but it is handled by scoring, never by tolerating geometry errors.
6. **Measurement is mandatory; enforcement is policy.** Every render is measured (run record, verification capture — even when enforcement is off). Whether a failed measurement blocks delivery is a per-profile, per-audience policy decision.
7. **Identity is explicit.** Every artifact records which model, brief, blocks, judge, and code produced it. Most of this system's historical failures were identity-tracking failures, not quality failures.
8. **Portable core, declared edges.** Provider independence lives at the seams — briefs, verification, evaluation are provider-agnostic. Provider-specific strengths (reference images, conditioning, batch) are used deliberately through declared capabilities, never leaked implicitly.
9. **Freeze briefs, not code.** Reproducibility comes from versioned data. Frozen code rots when its model dies; a frozen brief replays on anything.
10. **An abstraction must delete more complexity than it adds** — measured concretely: does it reduce the number of places a fact is maintained, the number of files a change touches, the number of things that can silently disagree?
11. **No capability ships without a metric that can fail it.** ("Every feature must improve measurement" was considered and rejected as too absolute; this is the enforceable form.)

*Rejected candidate principles, for the record:* "Verification is mandatory, not optional" (contradicts reality and intent — enforcement is policy; measurement is what's mandatory, see #6); "Geometry preservation is more important than stylistic transformation" (true but incomplete — encoded with its asymmetry as #5); "Provider independence is mandatory" (as stated it forbids using NB Pro's 14-ref anchoring or FLUX conditioning — refined into #8).

---

## Stability Tiers: Stable Core vs. Experimental Capabilities

The blueprint distinguishes architecture that is **settled** from capabilities that are **hypotheses under test**. Experimental capabilities may not accrete permanent infrastructure, permanent config surface, or documentation-as-fact until promoted. Promotion and abandonment both happen through the gate and are recorded as ADRs.

### Stable Core (foundational; survives model churn)
**Microservice boundary + the production `/generate-visualization` contract** (the most protected item on this list — breaking it additionally requires a migration strategy for the production caller, per the Production Integration Objective) · Provider Registry + Model Policy · AGT (Rev1 semantics) · Prompt Block Registry + canonical composer · Task Profiles · RenderBrief as central artifact · Verification (measure → diff → policy) · Run Records · Evaluation Platform + ledger · Catalogue resolver trust boundary.

These change only via ADR with gate evidence.

### Experimental Capabilities

| Capability | Why experimental | Hypothesis under test | Promote when | Abandon when |
|---|---|---|---|---|
| **FLUX depth-conditioned lane** (§7 L4) | New vendor, new pipeline stage, unproven on our inputs | Depth conditioning reduces scoped-edit structural failures on *amateur phone photos* | ≥15% scope-bleed reduction + zero AGT hard violations on T3 gate cases vs NB2 | No significant gain on amateur photos; or licensing/ops cost exceeds benefit; or native Gemini conditioning matches it (tripwire §13.7) |
| **Depth estimation stage** (`geometry/`) | Exists only to serve the FLUX lane | Monocular depth is reliable enough on user uploads to condition on | Rides with FLUX lane promotion | Rides with FLUX lane abandonment — no orphaned infra |
| **Mask-scoped editing (SAM + Fill)** (§7 L5) | Segmentation adds a pipeline stage + failure modes | Masks beat prompt scope-locks for single-surface tasks | T3 wins vs prompt-only scope-locks by a margin that justifies the stage | Scope-locks + verification get within noise of masks |
| **Hero tier (NB Pro multi-ref)** | Cost 2× workhorse; product value unproven | Reference-image anchoring lifts product_fidelity enough to price a premium tier | T2 product_fidelity delta is visible to humans + contractor willingness-to-pay | Delta invisible in human audit, or margin negative |
| **Job/queue API (`/v2/visualizations`)** | *Demoted to experimental in this revision (§15)* — designed before it had a client | Async execution is required for hero tier / batch pricing / verification budgets | Hero tier promotes, or sync-path timeout pain is measured in production | Production sync (120s budget) remains sufficient and hero tier is abandoned |
| **Self-hosted models** | No measured throughput data exists; solo-operator ops burden | Unit economics invert at sustained >500k gens/mo | Measured img/min/GPU pilot beats managed+batch pricing with ops cost included | Managed batch pricing keeps parity, or volume never materializes |
| **Cross-vendor verification re-extraction** | Same-vendor blind-spot is a hypothesis, not an observed failure | A non-Google re-extractor changes verification outcomes on the golden set | Outcome deltas found and they correlate with human judgment | No meaningful outcome difference on golden set |
| **Native conditioning APIs** (Gemini depth/mask) | Doesn't exist yet | — (standing tripwire, not an experiment) | Ships → rerun FLUX-lane comparison on-family | n/a |
| **Any new provider** | By definition | Beats the incumbent on the relevant profile's gate cases | Gate win + ADR | Gate loss — adapter deleted, not shelved |

---

## 1. System Vision

### Purpose
The Visualization Engine is ReformAI's core rendering intelligence: given one photograph of a real space, a design intent, and optionally a set of concrete products, it produces a photorealistic renovation of *that exact space* — same camera, same geometry, same openings — with surfaces, finishes, fixtures, and furnishings transformed, and every output accompanied by machine-readable evidence of structural compliance.

### Responsibilities (owns)
- Scene understanding and Architectural Ground Truth (AGT) extraction
- Render brief construction (prompt/constraint composition)
- Model/provider selection and execution
- Geometry preservation across all mechanisms (prompt, conditioning, masks)
- Post-generation verification and bounded retry
- Per-request run records (what model, what brief, what verification outcome)
- The evaluation platform (gate, ledger, golden datasets) that decides every promotion

### Boundaries (does not own)
- **Users, sessions, saved visuals, likes, marketplace** — owned by `Reform-AI/apps/api` (drizzle/Postgres). The engine is stateless with respect to users.
- **Catalogue storage and ingestion** — canonical catalogue data lives in Reform-AI's database (fed by `ReformAI-Inc/web-scraper`); the engine consumes resolved product records through its trust-boundary resolver.
- **End-user UX** — `Reform-AI/apps/web`. The engine's sandbox is a QA instrument, never a product surface.

### Explicitly deferred product capabilities *(added in revision 2 — V1 was silent on these, which read as "forgotten" rather than "deferred")*
The PRD promises **multi-candidate generation** ("generate 4–8, select best") and **persistent design sessions / iterative refinement**. Neither is in this blueprint's build scope. Deferral rationale: candidates multiply cost 4–8× before verification exists to rank them — verification-ranked best-of-N is the *right* version of this feature and depends on the eval/verification machinery maturing first; sessions are platform-domain state (Reform-AI) with one engine-side prerequisite already encoded here (re-anchor against the ORIGINAL upload, §7.4). Both become candidate ADRs when picked up. Deferred ≠ rejected.

### Platform position (verified 2026-07-02)
Production (`Reform-AI/apps/api`, `visualization.service.ts`) already treats the engine as an external microservice over `POST /generate-visualization` with a contract this repo's service satisfies drop-in. **This boundary is one of the strongest existing decisions — keep it.** The engine replaces the legacy `reform-ai-image-visualization-service` via a `VISUALIZATION_SERVICE_URL` cutover; from then on, this codebase *is* the production visualization service, and everything in this blueprint is a production concern.

**What remains exactly as-is:** the microservice boundary and its multipart contract; the sandbox-as-QA-tool stance.

---

## Production Integration Objective

**The primary objective of this repository is to produce a production-ready visualization service that can be deployed independently and integrated into the ReformAI production platform with minimal application changes.**

The Visualization Engine is not an isolated research project or a demonstration application. It is intended to become the production visualization backend for ReformAI. This is not aspiration — the integration point is already verified: `Reform-AI/apps/api` calls its visualization service through `VISUALIZATION_SERVICE_URL` with a request/response contract this service satisfies drop-in, which means the adoption path is **configuration plus limited integration work (auth), not an application rewrite**. Every architectural decision must protect that property.

Unless there is a compelling architectural reason otherwise, the integration strategy always favors:

- **preserving the existing API contract** (`POST /generate-visualization`, multipart fields, response shape — enumerated in §2.2)
- **minimizing required changes inside the ReformAI production repository** (target for initial cutover: one env var + one IAM grant + ID-token minting in its HTTP client)
- **maintaining backwards compatibility during migration** (old and new services swappable via configuration until the old model's EOL removes the floor)
- **allowing the production application to swap visualization services primarily through configuration**
- **minimizing deployment risk** (rollback is always a config flip, never a code revert in the production repo)
- **minimizing operational complexity** (one deployable, no coordination-heavy topology)

**The standing test for every proposal in this document and every future one:**

> *"Does this make production integration easier or harder?"*

If a proposed architectural improvement significantly increases integration complexity, that tradeoff must be explicitly justified and documented through an ADR (§14) — including the migration strategy for the production side. Silence on integration impact is not neutrality; it is an unexamined risk.

**Contract stability rules (the microservice boundary, strengthened):**
1. The existing production API contract is part of the **Stable Core** architecture (Stability Tiers) — the same protection level as AGT and the evaluation platform.
2. **Breaking changes to the production interface require an ADR and a migration strategy** — including versioned coexistence (old contract served alongside new until the production caller migrates), never a flag-day break.
3. **Internal architecture may evolve freely provided the external contract remains stable.** Profiles, policies, providers, geometry lanes, storage — all of it can change without the production platform noticing. That freedom is the *reward* for keeping the contract frozen, and losing it is the price of breaking it.

---

## 2. Architecture

### 2.1 Evolved topology

```
Reform-AI apps/web ──► Reform-AI apps/api ──(OIDC, run.invoker)──► Visualization Engine (Cloud Run)
Sandbox (QA) ────────► Netlify fn (proxy) ─────────────────────────►        │
                                                                            │
  vis-service (one deployable, responsibility-organized — layout preserved and extended)
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ transport/    HTTP + auth + (new) job endpoints: submit / poll / result      │
  │ intake/       (new) image validation, transcode, quality scoring             │
  │ guardrails/   AGT extract / classify / diff / verified-generation  [KEEP]    │
  │ geometry/     (new, Phase 3+) depth estimation, mask generation              │
  │ pipeline/     ONE composed pipeline: profile → brief → generate → verify     │
  │ prompts/      blocks/* registry [KEEP], composer with ENFORCED ordering      │
  │ models/       provider registry [KEEP] + model policy + adapters             │
  │ catalog/      resolver trust boundary [KEEP] + sanitizer + storage adapter   │
  │ runs/         (new) per-request run-record persistence                       │
  │ shared/       types, registries — single-source-of-truth modules             │
  └──────────────────────────────────────────────────────────────────────────────┘
       │                    │                          │
  GCS (uploads/outputs/  Provider APIs            eval/ (offline: gate, judges,
  run records)           (Gemini, FLUX, …)        golden sets, ledger — imports
                                                  production modules, never forks)
```

> **Current → Recommended:** same single service, same `src/{transport,pipelines,prompts,guardrails,models,catalog,shared}` organization → add `intake/`, `geometry/`, `runs/`; collapse `pipelines/versions/*` into one `pipeline/`.
> **Why insufficient today:** versioned pipeline forks triplicate behavior (F18-adjacent); no run persistence (F14); no intake stage (validation is scattered across assembler and prompt builders, F21/F22).
> **Essential:** `runs/` (migration observability), pipeline collapse (§8). **Desirable:** `intake/`, `geometry/` (arrive with their features).
> **Validation:** contract tests unchanged; `full_redesign` profile byte-identical to V8 output (existing backlog-16 contract).

### 2.2 API surface

| Endpoint | Status | Notes |
|---|---|---|
| `POST /generate-visualization` (multipart, sync) | **KEEP verbatim** | Production compatibility contract with Reform-AI. Never break it. |
| `GET /health`, `GET /api/catalogue` | KEEP | Catalogue endpoint gains server-side tenancy (§10). |
| `GET /v2/runs/:requestId` (debug-scoped) | NEW | Run record + verification detail for admin/sandbox; replaces returning `debug` to every caller (F13). |
| `POST /v2/visualizations` (job facade) | **EXPERIMENTAL — do not build yet** | See Stability Tiers. Revision-2 change: V1 of this blueprint presented the job API as settled; that was designing an API before it has a client. |

> **The internal shape still matters now:** the pipeline is implemented as a single `executeRun(request) → RunRecord` function with no HTTP coupling — *queueable later without refactor*. What we defer is the queue infrastructure and the second public API, not the decomposition. Verification retry budgets move from proxy-timeout-derived constants (F12) to profile policy immediately; production's 120s window (verified) absorbs them on the sync path.
> **Build the job API when:** hero tier promotes (multi-attempt, batch pricing) or measured sync-path timeout pain appears in production telemetry. Not before.

### 2.3 Observability (ESSENTIAL, pre-cutover)

One structured JSON event per stage, sharing `requestId`: `intake`, `agt`, `brief`, `generate` (modelId, latencyMs, usage, attempt), `verify` (outcome, violations, conclusive), `deliver`. Prod log level `info` (today `warn` silences everything — F14). Run record persisted to GCS/DB per request (§3). Error taxonomy codes aligned to the Error-UX framework (upload / generation / timeout / non-result / quality-suppressed) so Reform-AI's client can render actionable states instead of parsing prose.

> **Why:** today there is no server-side record of which model served a request — disqualifying for a model migration and for any A/B claim. This is the cheapest highest-leverage change in the blueprint.

---

## 3. Data Model

Ownership: **engine-owned** objects live in the engine's storage; **platform-owned** (users, saved visuals, marketplace) stay in Reform-AI. The engine references platform identities (contractorId, userId) but never stores user PII beyond request scope.

```
VisualizationRequest ─┬─► SourceImage (GCS ref, meta, qualityScore, depthMapRef?)
                      ├─► TaskProfile (resolved, §8)
                      ├─► StyleProfile (registry entry or custom; includes conflictClauses — fixes F21)
                      ├─► ProductSelection[] ──► CatalogueProduct (resolved via trust boundary, §10)
                      └─► RenderBrief (versioned, hashable, replayable — THE central artifact)
                              └─► GenerationAttempt[] (modelId, adapterId, latency, usage, output ref, mime)
                                      └─► VerificationResult (outcome, violations[], conclusive, reExtractorModelId)
RunRecord (aggregates all of the above per request; append-only; feeds dashboards + debugging)
EvaluationCase / EvaluationResult / LedgerEntry (eval platform, §9 — includes gitSha, modelIds, judge hash, humanSignoff)
ModelPolicy (config: profile × tier → modelId + options; env-overridable; §6)
AGT / RoomFacts (Rev1 shape KEPT VERBATIM: AGTField<T>{value, confidence:'high'|'medium'|'low'}, instances[], camera never hard)
```

Lifecycle: request → intake → (AGT ‖ depth) → profile resolution → brief → attempts (≤ policy budget) → verification → delivery/suppression → run record sealed. Run records are immutable after sealing; ledger entries are append-only (existing decision, kept).

> **Current → Recommended:** implicit in-memory param bags (`GenerateVisualizationParams`) → explicit persisted artifacts with versions and hashes.
> **Why:** identity must be explicit — the repo's recurring failure (which model? which prompt? which judge?) is an identity-tracking failure, not a quality failure. A frozen *brief* replays on any model; frozen *code* rots when its model dies (F11's lesson — the 9 legacy services die Oct 2 and take their benchmarks with them).
> **Essential:** RenderBrief versioning + RunRecord. **Desirable:** full relational persistence (start with GCS JSON blobs keyed by requestId; a database index can come later without schema pain).
> **Validation:** replay test — a stored brief re-executed against the same model policy reproduces an equivalent request payload byte-for-byte.

---

## 4. Visualization Pipeline

One pipeline. Stages, dependencies, and failure semantics:

```
1 INTAKE      validate mime by magic bytes; enforce size (400, not 500 — fixes F22); transcode HEIC→JPEG;
              downscale >4MP; quality score (brightness/blur); roomPhotoConfidence
              FAIL → typed 400 with Error-UX code. Never silently proceed on garbage.
2 UNDERSTAND  AGT extraction (timeout 2s → FALLBACK_AGT; never blocks — KEEP) ‖ depth estimation
              (Phase 3+, cached beside SourceImage; failure = lane degradation, not request failure)
3 RESOLVE     TaskProfile (deterministic rules → LLM only if ambiguous, §8); StyleProfile registry
              (explicit substitution — log when registry overrides client, fixes F21); catalogue resolution
              (trust boundary; failures → 400 with per-item reasons)
4 COMPOSE     RenderBrief: blocks in ENFORCED canonical order (assert, don't `void` — fixes the decorative
              CANONICAL_BLOCK_SEQUENCE); provider adapter chosen by model policy
5 GENERATE    provider call: per-call timeout 60s + AbortSignal; 429/5xx → 2 retries exp+jitter;
              provider failover per policy (§6); scan ALL candidate parts for image; capture real mime (F7/F8)
6 VERIFY      per-profile policy: re-extract (correct mime) → diffAGT (semantics KEPT VERBATIM) →
              violation → corrective retry (budget from profile, not from proxy timeouts) → keep best attempt.
              Extraction failure = inconclusive PASS, logged and counted — never silent (fixes the bare catch).
7 DELIVER     consumer flows: suppress verified-fail outputs + auto-retry framing (PRD §2.2);
              contractor/debug flows: deliver flagged. Seal RunRecord. Response contract unchanged.
```

Retry strategy summary (three distinct budgets, never conflated): **transport retries** (Reform-AI client: 2 — exists), **provider retries** (5xx/429: 2, engine-side — new), **verification retries** (semantic: per-profile 1–2 — exists, generalized). Observability: every stage emits its event; every attempt is in the run record.

**What remains exactly as-is:** AGT fallback-never-blocks; diffAGT asymmetries (boolean removal violates, addition allowed; low-confidence re-extraction = inconclusive); keep-best-attempt selection; the room image sent twice (base + re-anchor) — this V5-era trick demonstrably works and survives every provider.

---

## 5. Intelligence Layer

How the engine *reasons*, layer by layer — mostly a formalization of what exists:

- **Scene understanding:** AGT is the semantic layer (counts, openings, camera, confidence); depth maps (Phase 3+) are the geometric layer. They are complementary representations of the same scene, produced in parallel at intake, both cached on SourceImage.
- **AGT:** Rev1 design preserved verbatim — *AGT is evidence, not truth*; enum confidence ("a float implies precision the extractor cannot deliver"); hard tier requires high confidence AND instance agreement; camera perspective never hard. **New:** the extractor becomes a measured component — labeled golden fixtures, precision ≥90% / false-hard-rate ≤5% gates (spec targets, finally enforced) run on every extractor model/prompt change (F9). Extraction parsing moves from hand-rolled to Zod.
- **Intent → task routing:** deterministic rules first (catalogue selection present → product profile; "only/just/keep" text patterns → scoped candidates; preset-only → full_redesign); flash-tier LLM classification *only* for ambiguous free text, output constrained to the profile enum, decision + rationale logged. Misclassification defaults conservative: `full_redesign` (over-transforming is the established product behavior; a wrong scope-lock reads as "it ignored me").
- **Catalogue/product reasoning:** resolver (KEEP) → sanitized `renderDescription` → anchor blocks (Tier 2B structure KEEP). Products carry `role: primary|accent`; primary products lead the brief in product profiles (V8's real insight, absorbed). Where the selected model supports reference images (NB Pro up to 14, FLUX.2 up to 10 — PSA), usable product images attach as parts-level references; text anchors remain the universal fallback. The long-unused `imageUrl` finally earns its keep.
- **Prompt construction:** the block registry is the single prompt vocabulary. Per-provider deltas are **block overrides keyed by (blockId, modelFamily)** — never new prompt families. The 15-folder prompt tree is the monument to why.
- **Provider selection:** pure config (§6). No reasoning at request time beyond policy lookup + capability check.
- **Verification & evaluation:** verification is the per-request referee (AGT diff — provider-agnostic by design, its core value); evaluation is the per-release referee (gate, §9). Same vocabulary (hard rejection rules, AGT fields), different cadence. Neither may share a vendor with what it judges where avoidable — Anthropic judges Gemini (existing rule, kept); a non-Google re-extraction VLM is a §13 experiment.

---

## 6. Provider Architecture

The registry shape (supports() match, lazy import, sync resolve for key-free tests) is **kept**. What evolves around it:

```ts
// models/policy.ts — the ONLY place model ids exist (kills DEFAULT_IMAGE_MODEL hardcode,
// AGT_EXTRACTION_MODEL scatter, NB2_IMAGE_MODEL special-casing, 9 legacy hardcodes)
MODEL_POLICY: {
  extraction:        { model: env('AGT_EXTRACTION_MODEL', 'gemini-3-flash') },
  generate_default:  { model: env('IMAGE_MODEL_DEFAULT', 'gemini-3.1-flash-image'), fallback: [...] },
  generate_hero:     { model: env('IMAGE_MODEL_HERO', 'gemini-3-pro-image'), asyncOnly: true },
  generate_scoped:   { model: env('IMAGE_MODEL_SCOPED', 'gemini-3.1-flash-image'),
                       challenger: { model: 'flux-2-pro', conditioning: ['depth'] } },  // gate-compared, no live traffic split — see below
  judge:             { model: cfg('judge_model'), vendorMustDiffer: 'generator' },
}

ProviderCapabilities = { refImagesMax, maskEdit, conditioning: ('depth'|'edges')[],
                         maxOutputPx, batchApi, costPerImage1K, p50LatencyMs }
```

- **Capability discovery:** static per-provider capability declarations (checked by the composer before attaching refs/conditioning; graceful degradation to text anchors). Not runtime probing — determinism over cleverness.
- **Routing:** profile + tier → policy entry. **Challenger comparison is gate-first, not traffic-split** *(revision-2 change: V1 sketched a `trafficPct` live A/B knob, which quietly contradicted "the gate decides" and added a production variance source for a team with no one watching dashboards at 2am — removed until there is both traffic volume and staffing to justify it)*. A challenger runs the gate against the incumbent's cases; optionally, shadow generation (challenger renders the same briefs offline from run records — costs API spend, risks nothing user-facing).
- **Config change control:** `MODEL_POLICY` env overrides are for rollback and staging. A *production default* change is a promotion — it requires a gate PASS reference and lands as a ledger entry, exactly like a model promotion. An env var silently redefining production behavior is the same class of failure as a hardcoded model id, just faster to make.
- **Fallback:** per-policy ordered fallback list; same-family first (NB2 → NB2-lite under quota pressure) then cross-provider only if the brief is capability-compatible; every failover is a first-class telemetry event.
- **Benchmarking:** the gate with `--candidate` *is* the provider benchmark (PSA Part 5: no public benchmark measures renovation; ours does).
- **Onboarding a provider** (checklist, ~days not weeks): adapter implementing the registry interface over **neutral parts** (rename `GeminiPart` — F-leak); capability declaration; block overrides if prompting style differs; gate run vs incumbent; ledger entry. **Retiring a provider** (the EOL playbook we lived): freeze its briefs' historical run outputs as the visual reference, remove policy entries, delete the adapter. Never keep dead model code "for comparison" — that's F11.

> **Current → Recommended:** registry exists but model ids are scattered across 12+ locations with inconsistent override surfaces → single policy module.
> **Why essential:** the Oct 2 cutover, the NB2 flip, and every future A/B all reduce to policy edits — or they reduce to hunting hardcodes under deadline. We know which one happens under deadline.
> **Validation:** grep-clean assertion in contract tests: no `gemini-|flux-` string literals outside `models/policy.ts` and provider modules.

---

## 7. Geometry Preservation (the deep section)

### 7.1 The finding that shapes this section

The provider research produced one decisive, adversarially-verified result (PSA Part 2): **unconditioned frontier models — including Google's best — reinterpret architectural geometry** ("stair geometry shifts… it's no longer *your* design" — Autodesk), while **depth-conditioned generation preserves it** ("the depth map keeps walls, floors, and furniture where they belong"). Every production player with evidence (Zillow/VSAI, Beike, RoomGPT) chose geometry-aware architectures. Meanwhile our V7 gate data shows prompt-space discipline *works well* on cooperative inputs (12/12 PASS, 0 hard rejections).

Both facts are true. The synthesis: **prompt-space control is the floor, geometry-space control is the ceiling, and verification is the referee between them.** The architecture must let all three coexist without competing.

### 7.2 The layered defense

| Layer | Mechanism | Provider-dependent? | Role |
|---|---|---|---|
| L0 | Structural prompt blocks (PRESERVE lists, negative constraints) | No | Baseline pressure — exists, keep |
| L1 | AGT hard facts in brief ("EXACTLY N windows") + echo block | No | Semantic constraints from evidence — exists, keep verbatim |
| L2 | Re-anchor source image (position N) | No | Visual grounding — exists, keep |
| L3 | Post-generation verification: re-extract → diffAGT → corrective retry | No | **Measurement + enforcement of last resort** — exists, generalize per-profile |
| L4 | Depth conditioning (FLUX.2 lane; any future conditioning-capable provider) | Yes | **Hard geometric enforcement** — new, Phase 3 |
| L5 | Mask-scoped editing (SAM-class segmentation + Fill/mask-edit) | Yes | **Scope enforcement** for "flooring only" — new, Phase 4+ |
| L6 | Native conditioning in foundation APIs | Yes | Watch item — if Gemini ships depth conditioning, L4 collapses into the primary provider (PSA revisit trigger a) |

### 7.3 Why the layers complement instead of compete

- **AGT (L1/L3) is provider-agnostic measurement.** It works identically over Gemini, FLUX, or anything else — that is its architectural value, and why it survives every provider decision. It cannot *guarantee* geometry (text-space ceiling), but it can always *detect* geometry failure. Verification therefore becomes the arbiter that decides, empirically, per task profile, whether a conditioned lane outperforms the prompt-constrained lane.
- **Depth conditioning (L4) is enforcement, not understanding.** A depth map pins the geometry but knows nothing about "3 windows" semantics or product anchors. It slots into the pipeline as a *parts-level input* selected by policy — the brief, the blocks, the AGT constraints all remain unchanged. Concretely: monocular depth estimation (Depth-Anything-class; API or small self-host) runs at intake in parallel with AGT, cached on SourceImage; the composer attaches it only when the policy's model declares `conditioning: ['depth']`.
- **Masks (L5) enforce scope, not geometry.** For `flooring_only`, a floor mask makes "change only the floor" a physical constraint rather than a plea. Masks compose *with* depth (geometry fixed AND region fixed) and *with* AGT (verification still diffs the unmasked scene — catching mask-boundary bleed).
- **The gate decides lane assignments.** Each task profile carries a model lane; a lane change (e.g., scoped profiles move to FLUX+depth) requires beating the incumbent on that profile's gate cases with zero AGT hard violations. No lane wins by argument.

### 7.4 Failure-mode coverage map

| Failure mode | Caught/prevented by |
|---|---|
| Invented/deleted window or door | L1 prompt + L3 diff (count fields) + L4 prevents outright |
| Wall/opening topology change | L4 primarily; L3 booleans partially; judge hard-rejection rules at eval |
| Camera pose drift | L2 re-anchor + L4; L1 advisory only (camera never hard — keep) |
| Scope bleed ("flooring only" repaints walls) | L5 primarily; L3 with `agtStrictness: strict` + scope_compliance eval dimension |
| Window aspect/mullion drift (V7 spec deferred item) | Sub-AGT-resolution today [gap]; L4 depth helps proportions; §13 experiment |
| Refinement accumulation drift | Re-anchor against ORIGINAL upload always (never previous output) — policy, exists in spec, enforce in pipeline |

> **Current → Recommended:** L0–L3 only → L0–L5 with policy-driven lane selection.
> **Why insufficient today:** the ceiling is real and adversarially verified; scoped edits (a PRD promise) have no enforcement mechanism at all.
> **Essential:** none of L4/L5 blocks the EOL migration. **Strategically essential** within 12 months: L4 challenger measured, because it is the defensible moat — anyone can call the Gemini API; a verified geometry-preservation stack is a product.
> **Validation:** scoped gate cases with `scope_compliance` + AGT-diff metrics; promotion rule ≥15% scope-bleed reduction AND zero hard violations (plan's own bar, now falsifiable).

---

## 8. Task Profiles (V9, done right)

The existing backlog 15–17 design is correct; this section elevates it to the architecture's core routing abstraction and kills version proliferation permanently.

```ts
// shared/profiles.ts — profiles are DATA. ~20 lines each. No profile ships a new prompt family.
TaskProfile = {
  task: 'full_redesign' | 'surface_restyle' | 'flooring_only' | 'cabinet_only' | 'wall_finish'
      | 'lighting_only' | 'product_install' | 'furniture_injection' | 'minimal_edit',
  transformScope: SurfaceRegion[],
  lockedScope: SurfaceRegion[] | 'all_except_transform',
  constraintEmphasis: 'geometry' | 'material_fidelity' | 'item_identity',
  agtStrictness: 'standard' | 'strict',          // strict = advisory facts also verified
  modelLane: keyof MODEL_POLICY,                  // links §6 and §7
  verifyBudget: 0 | 1 | 2,
  judgeDimensions: string[],                      // which eval dimensions apply (scope_compliance only for scoped)
  blocks: BlockRef[],                             // scope-lock / task-emphasis additions to the canonical sequence
}
```

Composition rules:
1. **One composer.** Every profile feeds the same `compose()`; profiles add/parameterize blocks, never replace the canonical skeleton.
2. **`full_redesign` is the identity profile** — byte-identical brief to the pre-V9 composer, contract-tested. This is the rollback guarantee (existing backlog-16 idea, kept): V9's global rollback is "select identity profile."
3. **`product_install` absorbs V8.** V8's catalogue-first insight (products lead the brief) becomes this profile's block ordering; the V8 handler is then deleted. This also resolves F10 (V8 has no NB2 path) without writing one.
4. **Profiles change exactly four things:** brief blocks, verification policy, judge dimensions, model lane. If a proposed profile needs a fifth thing, it's not a profile — it's an architecture change; stop and think.
5. **Sequencing (non-negotiable):** gate v2 scoped/catalogue cases and the scope-bleed baseline exist **before** V9 code. Building scope-locks before scope compliance is measurable repeats the ship-without-proof failure this whole phase exists to end.

> **Current → Recommended:** 14 modes / 12 pipeline handlers / 15 prompt folders → 9 data profiles × 1 pipeline.
> **Why essential:** the mode-fork pattern already cost ~4,600 lines of frozen duplicates, three hand-synced mode lists, and an EOL blast radius of 9 files. Profiles make new behavior a config review, not a fork review.
> **Tradeoff:** the composer becomes the most load-bearing module in the system. Mitigation: it already is (all of V5/V7/V8 flow through it); the change concentrates tests where the risk lives.

---

## 9. Evaluation Platform

The gate is the constitution of this system: nothing is promoted — model, provider, profile, prompt block, extractor — except through it. Evolution of the existing `tests/regression` machinery (fix-first per F1–F5, then extend):

- **Case corpus (tiered):** T1 canonical style (the 12, kept) · T2 catalogue (product sets incl. a bad-product case) · T3 scoped edits · T4 degraded inputs (dark/cluttered/HEIC/no-window) · T5 geometry stress (many windows, mirrors, open-plan) · T6 moodboard (resurrect the dormant suite's intent into the main harness). Each case carries **human-labeled ground truth** (window/door counts, product SKUs) — this same labeling powers the extractor eval (§5).
- **Golden datasets:** fixtures + labels + accepted-baseline outputs, versioned in-repo. The ledger (`runs/ledger.jsonl`) commits to git — append-only JSONL belongs in history (F24).
- **Metrics per case:** structural (judge + validity classifier + **deterministic AGT input-vs-output diff as the third, judge-noise-free signal**) · style transformation (pressure-bucket aware) · product_fidelity (T2) · scope_compliance (T3) · defects.
- **Judging:** config-pinned judge model, `judge_version = hash(model + rubric)`; images scored independently in separate calls, position-blind, no candidate-only metadata (F6). Judge vendor ≠ generator vendor (kept). **Human review:** mandatory adjudication of every flagged hard rejection; ~20-verdict audit per promotion. *(Revision-2 change: V1 prescribed quarterly judge-vs-human calibration on a fixed set — process theater for a solo operator. Replaced with: the per-promotion audits ARE the calibration; track judge/human agreement across them, and bump judge_version only when agreement visibly drifts.)*
- **Block-change discipline:** a prompt-block text change is a gate-relevant change. `blockVersion` bumps require a gate PASS before the new text becomes default — blocks are the prompt-space equivalent of a model swap and get the same treatment.
- **Promotion criteria (two-key):** gate PASS — 0 *confirmed* hard rejections; median drop ≤0.25 vs the **production mode's** accepted baseline (cross-mode, F1 fixed); no single case drops >1.0; full case count enforced; validity coverage 100%; 3× repeats on promotion runs — **plus** recorded human sign-off in the ledger.
- **Rollback criteria:** pre-declared at promotion time (e.g., verification-failure rate ceiling over 48h; any confirmed structural complaint); rollback = policy env flip; rollback events are ledgered too.
- **Dashboards:** built on run records + ledger — verification outcome rates by model/profile, latency/cost per render, failover counts, challenger-vs-incumbent deltas. No new infra; a page over the data the pipeline now emits.
- **Acceptance mode:** `--base-url` lets the same gate run against any deployed instance — the cutover acceptance test and the staging smoke.

> **Why essential:** fully argued in F1–F5. One line: the current gate cannot fail an unknown candidate, and the evidence base under the accepted baseline is partially hand-patched. Everything else in this blueprint inherits its legitimacy from fixing that.

---

## 10. Security

- **Authentication:** production path — Cloud Run IAM: Reform-AI api's service account gets `roles/run.invoker`, ID token minted via metadata server (verified: apps/api runs on Cloud Run; its HttpClient today sends no auth). Sandbox path — existing Netlify OIDC proxy (kept) + shared secret. Nothing is publicly invokable (today the old service is, and this one is via its Netlify URL — F13).
- **Tenancy:** `X-Contractor-Id` dies as an identity claim. Concretely: the engine trusts tenant fields **only from IAM-authenticated callers** (Reform-AI api's service account identity, verified by Cloud Run) — an authenticated platform caller asserts contractorId on the user's behalf; unauthenticated paths get no tenant capabilities at all. The engine's resolver enforces ownership exactly as it does today (that logic is correct — the *input* was the hole). No custom signature scheme; IAM is the signature.
- **Catalogue sanitization (prompt-injection defense):** scraped/ingested text is data, never instructions. `renderDescription` is generated from structured fields, length-capped, stripped of imperative/instruction patterns and system-rule negations before it may enter a brief (F20 — today a catalogue description saying "ignore prior constraints" rides straight in). Same sanitizer applies to user `textPrompt` (the V5 sanitizer exists; unify).
- **Provider protection:** per-tenant + per-IP rate limits at the boundary; daily spend budgets per environment with hard stop + alert; anonymous sandbox traffic tightly capped.
- **Information exposure:** `debug` payload (full prompt engineering — the IP) behind an allowlist/flag (`GET /v2/runs/:id` debug-scoped); client errors are taxonomy codes + safe messages, never `error.message` passthrough (F13).
- **Secrets:** GCP Secret Manager → Cloud Run secret mounts; CI never echoes secrets through shell (F23); `npm ci`, non-root, multi-stage image.
- **Data privacy & retention** *(added in revision 2 — V1 omitted it entirely, and room photos are photos of people's homes)*: uploads and outputs get a declared retention policy (proposal: transient by default in the engine — GCS lifecycle deletion at 30 days; durable storage of saved visuals is Reform-AI's domain, where user consent and deletion requests already live). Run records store references and hashes, not indefinite image copies. **Provider training-data terms must be verified and recorded as an ADR before cutover** — whether Google/BFL train on API-submitted images at our tier is a customer-trust fact we currently do not have in writing.
- **Content moderation:** intake's room-photo classifier doubles as the abuse filter — non-room images are rejected for product reasons anyway; provider-side safety blocks are surfaced as typed intake errors, not opaque 500s.

**Essential before public traffic rides on this service (i.e., before cutover completes): auth, tenancy, debug gating, retention policy + training-data ADR. Desirable: the rest, fast-follow.**

---

## 11. Scalability

The design scales by knob-turning, not redesign:

- **Stateless service** (all state in GCS/DB) → Cloud Run horizontal scaling is free; concurrency tuned to image-buffer memory.
- **Job queue** absorbs burst and enables batch-tier routing: non-interactive renders (contractor listing pre-renders) go to providers' Batch APIs at −50% cost (verified pricing) — a pure policy decision once jobs exist.
- **Provider quotas are the real ceiling:** Google publishes no per-model image rate limits (PSA) — obtain written quota commitments as part of scaling, and let the policy's fallback lists (NB2 → NB2-lite) absorb quota pressure.
- **Cost linearity:** $0.067/render at 1K means 1M renders ≈ $67k/mo before batch offsets — the architecture's job is to keep the *marginal* cost per render flat (no per-request state, no fan-out amplification) and to keep the self-host option (FLUX/Qwen-class, H100 economics) executable if unit economics ever invert. The provider abstraction is what keeps that option cheap to exercise.
- **What does NOT scale and is deliberately excluded:** per-request model fine-tuning, synchronous hero renders, unbounded verification retries.

---

## 12. Technical Debt Disposition

**Remain exactly as-is (the load-bearing good decisions):**
AGT Rev1 tier semantics · diffAGT · prompt block registry + 11 block test suites · re-anchor image pattern · catalogue resolver logic · provider registry shape · judge-independence rule · append-only ledger concept · responsibility-organized src layout · the Reform-AI microservice contract · fallback-never-blocks AGT policy.

**Evolve:** pipeline versions → profiles (§8) · scattered model ids → policy (§6) · sync-only → job facade (§2) · debug-to-everyone → run records + scoped endpoint · gate per F1–F5 then v2 corpus (§9) · extraction parsing → Zod · style registry gains conflictClauses (F21).

**Generalize:** `GeminiPart` → neutral parts + adapters (F7-adjacent) · `extractGeminiError` → provider-owned error mapping · mode/category lists → single-source registries (F18) · violation-feedback retry block → per-profile corrective templates.

**Archive/delete:** 9 legacy pipeline services + ~3,500 lines of legacy prompt families (hard-dated — dead at Oct 2 anyway, F11; preserve their historical run outputs as the visual record) · V8 handler after `product_install` absorbs it · committed `dist/`/`dist-test/` · dead params (`geometryPreservation`, `phaseAnchoring*`, `ItemFidelityMode`) · stale tests and tsconfig ghosts · hardcoded "21/21" · dormant moodboard harness (absorb intent, delete code).

**Never build again:**
1. A new pipeline version as a fork (`balanced_v10/`) — profiles or nothing.
2. A new prompt family for a provider or model rev — block overrides or nothing.
3. A mode/category/model list maintained in more than one file.
4. A gate that can pass without a baseline comparison, or evidence hand-patched into manifests.
5. Guardrail policy derived from proxy timeouts.
6. A feature shipped "regression pending." (The memory file exists; the gate now enforces it.)

---

## 13. Future Research (ranked; each with its falsifier)

0. **Contingency, not research — if NB2 fails Run A** *(added in revision 2: V1 silently assumed promotion)*: (a) diagnose against the per-case floor — a narrow failure (one room class) may be fixable with block overrides and re-gated; (b) if broad, gate `gemini-3-pro-image` as workhorse-at-2×-cost while it's demonstrably strongest on consistency (PSA); (c) in parallel, gate gpt-image-2 accepting the latency hit for non-interactive traffic, and accelerate the FLUX lane evaluation. The Oct 2 floor means *something* Gemini-family almost certainly ships as the bridge; the contingency changes which tier and how much runway the alternatives get.

1. **FLUX.2 depth-conditioned scoped editing** (the strategic hedge) — validate: T3 gate cases, ≥15% scope-bleed reduction + zero AGT hard violations vs NB2, on amateur phone photos specifically (depth estimators degrade there; that's the real risk).
2. **NB Pro multi-reference product fidelity** — validate: T2 `product_fidelity` scores, NB Pro (≤14 refs) vs NB2-text-anchors vs FLUX.2 (≤10 refs). Decides whether the catalogue moat is reference-anchoring, and on which provider.
3. **AGT extractor benchmark + successor selection** — validate: labeled-fixture precision/tier-drift harness (§5); also answers whether extraction on *generated* (stylized) images — verification's input distribution — degrades.
4. **Mask-scoped editing (SAM + Fill/mask-edit)** — validate: T3 with mask lane vs prompt-only scope-lock; measures whether L5 beats L0-L3 for `flooring_only` enough to justify the segmentation stage.
5. **Cross-vendor verification re-extraction** — validate: does a non-Google VLM re-extractor change verification outcomes on a fixed golden set? (Same-vendor blind-spot hypothesis; cheap to test, informative either way.)
6. **Window proportion/mullion drift detection** — the known sub-AGT-resolution gap; candidate approach: edge-map similarity scoring on window regions (deterministic, no judge). Validate against the labeled golden set.
7. **Native Gemini conditioning watch** (not an experiment — a standing tripwire): if Gemini image APIs ship depth/mask conditioning, rerun experiment 1 on-family; PSA revisit trigger (a).
8. **Self-host throughput pilot** — only at sustained >500k/mo: measured img/min/GPU for FLUX.2/Qwen-class at production quality; no public data exists, so no decision before measurement.

---

## 14. Architectural Decision Records

The system's history shows that *decisions* survive worse than *code*: the v6-alias reversal, the human-judging→automated-gate philosophy flip, and the verification-in-V7 no-then-yes each happened without a durable record, and each later cost a session of archaeology. ADRs fix the class of problem.

### Framework
- **Location:** `docs/adr/NNN-short-slug.md`, numbered sequentially, never renumbered, never deleted (superseded ADRs are marked, not removed).
- **Template (all fields required):** Status (Proposed / Accepted / Superseded-by-NNN) · Context · Problem Statement · Alternatives Considered (minimum two, with why-rejected) · Decision · Consequences · Tradeoffs · Validation (what evidence supports it — gate run ids, ledger entries, PSA/review citations) · Date · Owner · Related PRs.
- **When an ADR is required:** any change to a Stable Core component (Stability Tiers section); any promotion/abandonment of an Experimental Capability; any new provider, model default, or profile; any deviation from a §0 principle; any decision someone would otherwise reconstruct from git archaeology in six months.
- **When it is NOT required:** implementation details inside a settled decision, routine block tuning that passes the gate, dependency bumps. ADRs preserve *intent*, not activity.
- **Process:** the ADR ships in the same PR as the change (or precedes it for large work). The gate evidence link is not optional for quality-affecting decisions — an ADR that says "we decided" without "and here's the run that proves it" violates principle #3.

### Backfill list — the decisions that must not remain oral history
| # | Decision | Evidence to cite |
|---|---|---|
| ADR-001 | **Optimize, not rebuild** | Architecture review 2026-06-11; re-confirmed REPO_REVIEW 2026-07-02 |
| ADR-002 | **The microservice boundary and the frozen `/generate-visualization` contract** | Verified Reform-AI integration (review ADDENDUM); cutover-not-port conclusion |
| ADR-003 | **AGT is evidence, not truth** (enum confidence, camera never hard, fallback never blocks) | V7_IMPLEMENTATION_SPEC_REV1 §4/§7; gate run_20260611_003712 |
| ADR-004 | **Provider abstraction + single model policy** | Backlog 11; F-findings on hardcode scatter; Oct 2 EOL |
| ADR-005 | **Task profiles replace pipeline versions** | Backlog 15–17 design; the 4,600-line fork cost; §8 |
| ADR-006 | **Verification is provider-independent (AGT diff), enforcement is per-profile policy** | guardrails/verify.ts contracts; §0 principle 6 |
| ADR-007 | **Geometry preservation is layered (measurement ≠ enforcement)** | PSA Part 2 (Autodesk evidence); §7 |
| ADR-008 | **The evaluation platform is the sole promotion authority; judge vendor ≠ generator vendor** | F1–F5 (what happens without it); IMPLEMENTATION_PLAN judge-independence rule |
| ADR-009 | **Stay on Gemini primary + FLUX depth lane as hedge** (with the three revisit triggers) | PSA Part 9 |
| ADR-010 | **Job/queue API deferred** (internal decomposition now, infra later) | This document §2.2, §15 |
| ADR-011 | **Provider training-data terms** (to be written after verification — see §10) | pending |

---

## 15. Design-Review Record (revision 2 — self-critique applied)

This blueprint was reviewed as if by an external principal engineer before becoming authoritative. Findings, and what was done about each:

**Changed in this revision (V1 was wrong, not just incomplete):**
1. **Job/queue API demoted to experimental** (§2.2, Stability Tiers). V1 specified a `/v2/visualizations` API with no client, no measured sync-path pain, and a queue for a service whose production caller already grants 120s + retries. Classic premature infrastructure. The durable part — `executeRun()` decomposed away from HTTP — is kept; the infrastructure waits for hero tier or measured need.
2. **Live traffic-split A/B removed from MODEL_POLICY** (§6). `trafficPct` contradicted principle #3 (the gate decides) and added production variance no one is staffed to watch. Gate-first comparison + offline shadow generation replaces it.
3. **Quarterly judge calibration replaced** (§9) with calibration-by-accumulated-promotion-audits. The quarterly ritual was process designed for a team that doesn't exist here.
4. **Privacy, retention, provider training-data terms, and content moderation added** (§10). V1's security section protected the company's prompts and wallet but said nothing about the *user's home photos* — the more serious omission. Training-data terms became ADR-011 and a cutover blocker.
5. **NB2-fails contingency added** (§13.0). V1 silently assumed Run A passes; a master reference doesn't get to assume its way past its own gate.
6. **PRD promises (multi-candidate, sessions) moved from silence to explicit deferral** (§1) with rationale and re-entry path.
7. **Tenancy mechanism concretized** (§10): "signed/trusted assertion" was hand-waving; the concrete mechanism is IAM-authenticated-caller trust, no custom crypto.
8. **Config change control added** (§6): env-overridable policy was a promotion-bypass loophole in V1.
9. **Block-change discipline added** (§9): `blockVersion` existed in the data model with no rule attached; now block text changes are gate-relevant by definition.

**Reviewed and consciously kept:**
- The MODEL_POLICY/capabilities code sketches (§6) and the pipeline stage table (§4) are near the detail ceiling for a blueprint, but they are the two places where vagueness historically caused real damage (12+ scattered model ids; conflated retry budgets). Detail is the point there.
- §11 (Scalability) remains the thinnest section — deliberately. Scale problems at this stage are provider-quota and unit-economics problems, both covered elsewhere; inventing scaling architecture ahead of traffic would repeat finding #1 above at larger scope.
- The geometry section's length is justified: it is the company's core technical bet and the one place where the provider research materially changed the architecture.

**Added in revision 3 (external review feedback — Chuck, 2026-07-02):**
The document described the microservice boundary but framed the deliverable as "the architecture of the Visualization Engine" rather than "**a deployable service that replaces the production visualization service with minimal changes to the ReformAI application**." Those are different goals, and the second is the true one. Fixed by: the Production Integration Objective section (after §1) with the standing test *"does this make production integration easier or harder?"*; new principle #2 (Production-first architecture); contract-stability rules — the production API contract is Stable Core, breaking it requires an ADR **plus a migration strategy**, and internal architecture evolves freely only as long as the external contract holds. This reframing was implicit in the cutover analysis all along; the review correctly demanded it be explicit and enforceable.

**Known gaps, held open honestly (not resolved by this revision):**
- **Dashboards have data but no owner or definition** — "a page over run records" is a direction, not a design. Acceptable until run records exist; flagged so it isn't mistaken for done.
- **Window proportion/mullion drift** remains below AGT's resolution (§7.4, §13.6) — the one known structural failure mode with no current mechanism.
- **Solo-operator process risk** is structural and no document fixes it: the gate, CI test gates, credit preflight, and ADRs are mechanization of discipline, which is the available mitigation — not a substitute for redundancy.
- **Latency budgets per user flow** (what the homeowner experiences end-to-end, p95) are unstated because unmeasured; the §2.3 telemetry exists precisely to write this number down within weeks of cutover. A latency SLO ADR should follow.

---

## Closing statement

Nothing in this blueprint discards a load-bearing idea from the current system. Its strongest decisions — AGT-as-evidence, the block registry, the resolver boundary, the provider registry, the ledger, judge independence, the microservice contract — are the skeleton of V2. What changes is that behavior moves from *forks* to *data* (profiles, policies, briefs), quality moves from *asserted* to *measured* (a gate that can fail, run records that remember), and geometry preservation gains an *enforcement* tier beneath its existing *measurement* tier — with the stable core, the experiments, and the reasoning behind every major decision now explicitly separated (§0, Stability Tiers, §14) so the document stays honest as the system evolves. That is the implementation the original architecture was always evolving toward.
