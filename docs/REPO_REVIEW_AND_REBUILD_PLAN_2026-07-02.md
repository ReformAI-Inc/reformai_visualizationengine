# ReformAI Visualization Engine — Full Repo Review, Roadmap Validation, and Rebuild Plan

**Date:** 2026-07-02
**Reviewer role:** Principal engineer / AI systems architect
**Scope:** `apps/vis-service`, `apps/web-sandbox`, `netlify/`, `tests/regression`, `tests/moodboard_regression`, `docs/`, `archive/`, CI
**Verdict up front:** OPTIMIZE stands. But the roadmap's step 2 — "run the decisive NB2 gate" — is **not decisive as currently implemented**. `gate.py` would auto-PASS `balanced_v7_nb2` via `NO_BASELINE` without ever comparing it to V7. Fix the gate before spending a dollar on the head-to-head.

---

# PART 1 — REPO ANALYSIS

## 1.0 Architecture and data flow (as-is)

```
Browser (web-sandbox App.jsx, 877 lines)
  → Netlify CDN (netlify.toml redirects: /generate-visualization, /health, /api/catalogue)
  → netlify/functions/api.mjs (blind proxy; mints OIDC token per request; 26s hard timeout; ~4.5MB body cap)
  → Cloud Run Fastify (apps/vis-service/src/index.ts; private, OIDC-auth'd at infra level)
    → transport/controllers/visualization.controller.ts
    → transport/request/request.assembler.ts (Zod: transport/schemas/visualization.schema.ts)
    → pipelines/core/pipeline-dispatcher.ts (+ pipeline-routing.ts HANDLER_ALIASES: v6→v5)
    → pipelines/versions/{balanced-v5, balanced-v7, balanced-v8}/index.ts  (+9 legacy handlers)
      → guardrails/extract.ts (AGT, gemini-2.5-flash) → classify.ts (hard/advisory/suppressed)
      → pipelines/core/pipeline-composer.ts (canonical parts; room image sent twice: base + re-anchor)
      → guardrails/verified-generation.ts (flag verifyAGT, default OFF: generate → re-extract → diffAGT → 1 retry)
      → models/image-model.client.ts → provider-registry.ts → providers/gemini.ts (@google/genai)
    ← { message, data: { image: base64, metadata, debug } }   (debug = full prompt text, always returned)
```

Pipelines: V5 (no AGT; also serves v6 alias; catalogue anchors live here), V7 (canonical; AGT constraint+echo blocks, conflict clauses; NB2 variant via `generateVisualizationNB2`), V8 (catalogue-first installer voice; same AGT machinery; **no modelId plumbing**), 9 frozen legacy handlers (V1–V4.1, baseline, improved) each with their own `GoogleGenAI` client and hardcoded `gemini-2.5-flash-image`.

## 1.1 Findings register

Risk key: **C** Critical / **H** High / **M** Medium / **L** Low. "Blocks migration" = must be fixed before the NB2 promotion decision is trustworthy.

| # | Finding | Risk | Blocks migration? |
|---|---|---|---|
| F1 | Gate auto-PASSes unknown candidate modes (`NO_BASELINE`) | **C** | **YES** |
| F2 | Gate verdict ignores the validity classifier entirely | **H** | **YES** |
| F3 | Silent case-skipping shrinks n without failing the run | **H** | **YES** |
| F4 | n=1 sampling per case vs a 0.25 median threshold; no variance handling | **H** | **YES** |
| F5 | V8 gate evidence is 100% session-judged; V7 baseline 3/12 session-judged + 24/24 validity ERRORs | **H** | **YES** (re-judge) |
| F6 | Judge bias: sees both images in one call + candidate's own AGT/debug metadata (not baseline's); judge model hardcoded `claude-opus-4-7` | **M** | Partially |
| F7 | Provider parses only `parts[0]` of the first candidate; Gemini 3.x interleaves text+image parts | **H** | **YES** |
| F8 | `GENERATED_IMAGE_MIME = 'image/png'` assumed for re-extraction | **M** | **YES** (cheap fix) |
| F9 | AGT extraction pinned to `gemini-2.5-flash` (same EOL family); extraction quality on NB2 outputs unmeasured; extraction shape untested | **H** | **YES** (at least measure) |
| F10 | V8 cannot run on NB2 (no modelId param) → catalogue-first path dies with the old model unless migrated or superseded | **H** | Decision needed |
| F11 | 9 legacy pipelines hardcode the EOL model → all historical benchmark modes break Oct 2 | **M** | No (but hard-dated) |
| F12 | Netlify function 26s timeout kills long generations; verifyAGT ON multiplies latency; gate hits localhost so never sees this | **H** | No (production blocker) |
| F13 | Zero auth on `/generate-visualization`; `X-Contractor-Id` client-asserted; CORS `*`+credentials; full prompt IP in `debug` to every caller; error messages leak internals | **C** (for production) | No |
| F14 | No timeouts/retries/backoff on any model call; no request-scoped correlation; prod log level `warn` = no request logs; zero cost/latency/model-id persistence server-side | **H** | Partially (need model-id logging for A/B) |
| F15 | No gate coverage of catalogue flows, scoped edits, moodboards, refinement — the product's actual differentiators | **H** | For V8/V9, yes |
| F16 | Stale/broken tests: `pipeline-routing.test.ts` asserts pre-alias behavior (fails if run); `tsconfig.contract-tests.json` lists 3 nonexistent files; `runContracts.ts` hardcodes "21/21" | **M** | No |
| F17 | Committed build artifacts: `apps/web-sandbox/dist/`, `apps/vis-service/dist-test/`; archive contains a second dist-test snapshot | **L** | No |
| F18 | Mode list maintained in 3 places; default mode `balanced_v7` in 4 places; category enum duplicated in 3 places | **M** | No |
| F19 | Doc drift: ARCHITECTURE.md contradicts the v6 alias; PLATFORM_STATUS/CURRENT_STATE missing nb2 + verifyAGT; AGENT_HANDOFF self-contradicts; stale vis-service CURRENT_STATE copy; regression-philosophy contradiction (human-mandatory vs automated gate) | **M** | No |
| F20 | Catalogue contract not scraper-ready: closed 4-category enum, required hand-tuned `promptDescription`, no sanitization (prompt-injection vector), `imageUrl`/`attributes` unused | **M** | No |
| F21 | Silent style-registry substitution discards client `stylePreset` fields; `conflict_resolution` can never fire for registered styles (missing from `StyleObject`); unknown roomType → 500 on V5/V7 via `PromptInjectionError` | **M** | No |
| F22 | Dead params parsed and typed but consumed by nothing: `geometryPreservation`, `phaseAnchoring`, `phaseAnchoringV2`; `MAX_FILE_SIZE` declared, never enforced (oversize → 500 not 400); `ItemFidelityMode` never read | **L** | No |
| F23 | CI deploys on push to main with no test gate; secret piped through shell/jq; `npm install` not `ci`; root container; no healthcheck | **M** | No |
| F24 | `runs/` + `ledger.jsonl` live only in the main checkout; gate run from different cwds produced inconsistent `run_dir` strings; run-dir detection by mtime race | **M** | Should fix with F1 |

## 1.2 Finding details

### F1 — The gate auto-passes unknown candidates (CRITICAL)
**What:** `last_accepted_baseline()` (tests/regression/gate.py:102-115) filters the ledger by `candidate_mode == X`. A candidate mode never gated before (e.g. `balanced_v7_nb2`) has no matching entry → the median-drop check is skipped → verdict PASS with a `NO_BASELINE` note (gate.py:196-197). The in-run anchor pipeline score is recorded (`anchor_mode`, gate.py:171) but **never used in the verdict**.
**Proof it's real:** ledger entry 3 — `balanced_v8`, median **3.975** vs V7's accepted **4.425**, `baseline_run_id: null`, **verdict PASS**. A 0.45 regression sailed through the exact mechanism the roadmap depends on.
**Why it matters:** The entire migration strategy is "promote NB2 on gate evidence." As coded, the planned command `python tests/regression/gate.py --candidate balanced_v7_nb2` produces a PASS no matter how bad NB2 is.
**Action:** Add `--baseline-mode` (default: compare any candidate against the last accepted baseline of the *production* mode, `balanced_v7`), make `NO_BASELINE` a FAIL unless `--allow-no-baseline` is passed, and enforce `cases_evaluated == len(config cases)`.
**Files:** tests/regression/gate.py:102-115,154-163,196-197; config.gate.yaml thresholds block.

### F2 — Validity classifier is decorative
**What:** The independent validity classifier (source+output only, 6 structural violation enums) can only override the per-case *winner* (`apply_validity_to_winners`, run_regression.py:637-668); gate.py's verdict uses only the judge's self-reported `hard_rejections` and weighted medians. Run `run_20260611_003712` PASSed and became the accepted baseline with **24/24 validity calls in ERROR state** (Anthropic billing failure).
**Action:** Gate FAILs if any case has validity FAIL; gate FAILs (as infra error, exit 2) if validity ERROR count > 0 or classifier coverage < 100%.
**Files:** tests/regression/gate.py:154-163; run_regression.py:406-443,637-668.

### F3 — Silent case-skipping
**What:** Cases whose judgment is missing/unparseable are appended to `cases_skipped` and excluded (gate.py:89-91). The gate only errors at zero cases. This is how a 9-case "12-case" baseline got accepted. Judge JSON parsing is naive fence-splitting (run_regression.py:533-537) — any parse hiccup silently shrinks n.
**Action:** `min_cases_evaluated: 12` in config; any skip → exit 2 (infra failure, rerun `--eval-only`), never a verdict.

### F4 — Statistical rigor
**What:** One generation per case per pipeline, no seeds, judge at default temperature, threshold 0.25 on a median of 12 noisy draws compared against a baseline that is itself one noisy draw. Ledger shows per-case spread 3.95–4.75 under identical conditions.
**Why it matters:** Both false-FAIL (noise kills a good NB2) and false-PASS (noise masks a real regression) are live risks at exactly the decision that matters most this year.
**Action:** For promotion runs only: 3 generations per case per pipeline (36+36 images, still ~$15–20 and under 90 min), score all, use per-case median; keep 1× for routine runs. Alternatively (cheaper): keep n=1 but require two independent full runs to agree before promotion.

### F5 — Contaminated evidence base
**What:** V7 accepted baseline: 9/12 API-judged (all with validity ERRORs), 3/12 hand-patched `"judge": "session-claude-opus-4.8"`. V8 run: **all 12** session-judged, zero validity blocks. gate.py can't distinguish session-judged manifests from API-judged ones; anyone can hand-edit `manifest.json` and `--run-dir --set-baseline`.
**Action:** After credits: `--eval-only` re-judge of both runs via API; re-set the V7 baseline; treat current V8 conclusions ("under-transforms style") as provisional until re-confirmed. Add a `judge` provenance check to gate.py (reject non-API judges unless `--allow-session-judge`).

### F6 — Judge design bias
**What:** Judge scores baseline and candidate in a single call (anchoring, relative scoring) and receives the *candidate's* debug metadata including its AGT constraint block (run_regression.py:504-527) — the judge sees the candidate's own claims; the baseline gets no equivalent. Judge model `claude-opus-4-7` hardcoded twice (run_regression.py:453,516); `judge_version: "1.0"` is a manual label with no binding to the model string or prompt hash.
**Action:** Move judge model to config; compute `judge_version` as hash(model + rubric); strip AGT metadata from the judge payload or provide it for both sides; longer-term, score images independently in separate calls with position randomization.

### F7 — Provider response parsing will break on Gemini 3.x
**What:** `providers/gemini.ts:36` reads `candidates[0].content.parts[0]` and requires it to be inline image data. Gemini 3.x models routinely interleave a text part (reasoning/commentary) before the image part. Result: "No image returned by Gemini" errors on responses that contain a perfectly good image. The NB2 smoke test passing once does not clear this — part ordering is nondeterministic.
**Action:** Scan all parts of all candidates for the first inline image; capture its actual `mimeType`; add unit tests with synthetic multi-part responses. Same fix for `generateText` (line 54).
**Files:** apps/vis-service/src/models/providers/gemini.ts:36,54.

### F8 — Hardcoded PNG mime in verification
**What:** `verified-generation.ts:32` re-extracts AGT from the generated image assuming `image/png`. If NB2 returns JPEG/WebP, re-extraction gets a mislabeled payload — silently degrading verification exactly when it's supposed to prove itself.
**Action:** Thread the provider's returned mimeType through `GenerationResult` into re-extraction. One-line-ish fix after F7.

### F9 — AGT extraction is an unmeasured dependency
**What:** Extraction runs on `gemini-2.5-flash` (env-overridable, models/image-model.client.ts:13) — same EOL model family. Nothing measures extraction accuracy against labeled fixtures (V7 spec §16 open question, never closed). Extraction confidence rates directly set (a) which facts become hard prompt constraints and (b) how aggressive verification is. A migration of the extraction model silently shifts both. Parsing is hand-rolled, no Zod, untested (extract.ts:82-132).
**Action:** Label the 6 fixtures once (window/door counts etc. — an hour of human work); add a cheap `agt_accuracy.py` check that runs extraction 3× per fixture per candidate extraction model and reports precision on hard facts + tier distribution drift. Run it for `gemini-2.5-flash` (baseline) and the NB2-era replacement before the swap.

### F10 — V8 dies with the old model
**What:** V8's `generateWithVerification` call passes no `modelId` (balanced-v8/index.ts:131-136); there is no V8-on-NB2 path. V8 is also the designated catalogue-first server and the structural core of V9 per the plan.
**Action (decision):** Don't migrate V8 as a fork. Fold V8's catalogue-first framing into the V9 composition layer (backlog 15–16 already specifies V9 = V8 structural core + profile blocks) and let pipeline-level model selection be a parameter everywhere (see Part 3 §5). If V8 must serve catalogue traffic before V9 exists, add modelId plumbing (30 minutes) — but then it needs its own gate evidence on NB2, which needs catalogue gate cases (F15).

### F12 — The 26-second lie
**What:** `netlify.toml:5-6` caps the function at 26s. Generation regularly approaches/exceeds this; verifyAGT ON adds up to 1 extra generation + up to 3 extraction calls per request. The regression harness talks to `localhost:8080` directly (runtime_config.py), so the gate will happily certify a configuration that times out in production. The retry budget in verified-generation.ts:15-18 is *designed around* this proxy limit — an architectural constraint leaking into guardrail policy.
**Action:** Not a migration blocker (gate and Cloud Run are unaffected), but a production blocker for verifyAGT ON. Move to async job pattern (Part 3 §12) or call Cloud Run directly with proper auth from the client.

### F13 — Security posture (production-critical, migration-irrelevant)
- `POST /generate-visualization` is unauthenticated Gemini spend for anyone with the Netlify URL (infra OIDC protects Cloud Run, not the public Netlify route).
- `X-Contractor-Id` is a client-supplied header: catalogue enumeration + cross-tenant generation for free.
- CORS `origin: '*'` + `credentials: true` (index.ts:19-24) — invalid combo, masked by same-origin proxying.
- `debug` (full prompt engineering, AGT internals) returned to every caller (controller:34) — your prompt IP is public.
- Generic 500s echo `error.message` (controller:60).
**Action:** Before any real user traffic: shared-secret or JWT at the Netlify boundary, server-side contractor resolution, `debug` behind a flag/allowlist, generic client errors. None of this blocks the model swap.

### F14 — Observability void
No per-request model-id/latency/token/cost persistence anywhere; prod log level `warn` suppresses request logs; dispatcher uses `console.log` disconnected from Fastify's `reqId`. **You cannot answer "which model served this image, how long did it take, what did it cost" after the fact — the minimum telemetry for a model migration.**
**Action (pre-flip):** one structured log line per generation: `{reqId, mode, modelId, latencyMs, attempts, verification: {enabled, violations, conclusive}, imageBytes, ok}`. A day of work; do it before the default flip so the rollout is observable.

### F15 — The gate doesn't test the product's differentiators
The 12 cases are 4 rooms × 3 styles, style-only, `styleInfluence=50`, no catalogue selections, no scoped edits, no moodboards, no refinement (config.gate.yaml:41-74 says so explicitly — "gate v2 work"). Meanwhile: V6 catalogue integration is a shipped feature with zero gated coverage; V8's mission is catalogue-first with zero catalogue cases; V9's value (scope compliance) has no metric. The only moodboard harness (tests/moodboard_regression) is dormant, pinned to V5, last run 2026-04-30.
**Action:** Gate v2 before V9: +4 catalogue cases (2 rooms × 2 selection sets from `contractor_demo`), +2 scoped-edit cases, `scope_compliance` and `product_fidelity` judge dimensions. Required before promoting anything catalogue-related; not required for the V7→NB2 style-only swap.

### F16–F24 — Hygiene ledger (condensed)
- **F16:** `pipeline-routing.test.ts:9-11` asserts `balanced_v6` routes to itself — fails against `HANDLER_ALIASES`; nobody is running `npm test`. `tsconfig.contract-tests.json` references 3 files deleted in the refactor. `runContracts.ts:345` prints a hardcoded "21/21".
- **F17:** `web-sandbox/dist/` and `vis-service/dist-test/` committed; drift guaranteed.
- **F18:** Mode list in `visualization.schema.ts:42-46` + `pipeline-routing.ts:27-42` + `shared/types/core.ts:46`; default mode in 4 places; category enum in `catalogue.ts:5` + `resolver.ts:22` + `renovation-anchors.ts:12-17`.
- **F19:** ARCHITECTURE.md §8/§11 claim v6 has its own handler (reversed 06-11); PLATFORM_STATUS (same-day) missing `balanced_v7_nb2` and `verifyAGT`; AGENT_HANDOFF item 3 false; `apps/vis-service/docs/CURRENT_STATE.md` stale (2026-05-21); ARCHITECTURE.md §10 "human scoring is mandatory / automated scoring is unsolved" vs the automated gate — the strategic doc and the operating doc disagree about the company's core QA philosophy.
- **F20:** `CatalogueItem` requires hand-written `promptDescription`; closed enum of 4 categories; `promptDescription` injected verbatim into prompts with no sanitization (resolver:57 → renovation-anchors:87) — a scraped description saying "ignore prior constraints" rides straight into the model.
- **F21:** Registered styles silently replace client presets (assembler:64-68) and can never carry `conflict_resolution` (absent from `StyleObject`) — the conflict-clauses block is dead for every registered style, contradicting its own header comment.
- **F23:** deploy-on-push with no tests; `GOOGLE_SERVICE_ACCOUNT_KEY` piped through shell to jq; `npm install`; root user; no healthcheck despite `/health` existing.
- **F24:** `runs/` + ledger only in main checkout; two ledger entries share `run_id` with different `run_dir` spellings; new-run detection by directory mtime (gate.py:62-66).

## 1.3 What's genuinely good (don't break these)

- **Prompt block factoring for active versions** — real text lives once in `prompts/blocks/*`, V5/V7 re-export; 11 block unit-test suites.
- **AGT tier philosophy** ("evidence, not truth"; enum confidence; camera never hard; fallback never blocks generation) is the best piece of design thinking in the repo — Rev1 §4/§7 should survive any rebuild verbatim.
- **`diffAGT` is a pure, contract-tested module** with sane asymmetries (boolean removal violates, addition allowed; low-confidence re-extraction = inconclusive, not violation).
- **The catalogue resolver as a trust boundary** (ownership, category-slot, active/visible checks) is the right shape — it just needs sanitization and an open taxonomy.
- **The ledger/append-only run record concept** is correct; the implementation has holes (above), not the idea.
- **Provider registry shape** (supports() match, lazy import, sync resolve for key-free tests) is right; it's the surrounding assumptions (parts[0], GeminiPart naming) that leak.

---

# PART 2 — ROADMAP VALIDATION

## 2.1 The roadmap as stated, challenged

> 1. Top up credits → 2. Run NB2 head-to-head gate with verifyAGT ON → 3. Promote if PASS → 4. Retire old model → 5. Archive V1–V4 → 6. V9 routing → 7. Quality tiers.

**Broken at step 2, three ways:**

1. **The gate will not compare NB2 to V7.** F1: `balanced_v7_nb2` has no ledger baseline → PASS via NO_BASELINE. The "decisive head-to-head" is currently a formality that cannot fail on quality. This alone invalidates step 3 as planned.
2. **verifyAGT ON confounds the comparison.** The V7 accepted baseline was generated with verification OFF. Running NB2 with it ON measures (new model + verification retry) vs (old model, no verification) — if NB2 passes you don't know whether the model or the retry loop carried it; if it fails you don't know whether verification's extraction-on-NB2-outputs misfired (F8/F9 make that plausible). The 06-11 session's rationale ("V7 had 0 violations so ON/OFF on old model proves cost not benefit") is correct *for the old model* but doesn't justify confounding the promotion run.
3. **The evidence base needs cleaning first.** F5: the baseline you'd compare against is partially session-judged and 100% validity-ERRORed. Re-judge before it anchors a promotion.

**Also mis-sequenced:** archiving V1–V4 (step 5) is treated as post-promotion cleanup, but it's hard-dated — those 9 pipelines hardcode the EOL model and die Oct 2 regardless of promotion. And V9 (step 6) is scheduled before the gate can measure V9's value (no scoped/catalogue cases, no scope_compliance dimension — F15).

## 2.2 Direct answers

**Is the gate strong enough to justify model promotion?** No — not as coded. It's close: the run harness, rubric, ledger, and case discipline are real. But F1 (no cross-mode baseline), F2 (validity ignored), F3 (silent skips), and F5 (contaminated baseline) each independently break decisiveness. All four are fixable in under a day of Python work. After those fixes plus repeats (F4), yes — it's a legitimate promotion gate for the style-only surface.

**Are the 12 canonical cases sufficient?** For a like-for-like model swap on the style-only path: marginally, *with repeats* (3× per case) and after re-judging. They cover 4 rooms × 3 style-pressure tiers, which is a sane core. They are **not** sufficient for: catalogue flows (zero cases — yet V6 catalogue is shipped product), scoped edits, moodboards, refinement, degraded inputs (phone photos, dark rooms, no-window rooms — the bathroom's 0 windows is incidental, not designed). Don't block the swap on gate v2; do block V8/V9 decisions on it.

**Are the thresholds appropriate?**
- `max_candidate_hard_rejections: 0` — right spirit, wrong mechanics at n=1 with a noisy judge: one hallucinated rejection kills a run, and conversely the *judge's* self-reported list is the only input (F2). Change to: 0 *confirmed* hard rejections, where any judge- or classifier-flagged rejection triggers mandatory human review of that image pair (minutes of work, already the "human audits ~20 verdicts" philosophy in the plan).
- `max_median_score_drop: 0.25` — reasonable magnitude, but only meaningful with repeats (F4). Add a per-case floor: FAIL if any single case drops >1.0 vs baseline — a catastrophic single-room regression can hide under a healthy median.
- Add: `min_cases_evaluated: 12`, validity coverage = 100%, judge provenance = API.

**Should verifyAGT be ON during the NB2 comparison?** Not for the promotion run. Run twice:
- **Run A (promotion evidence):** NB2 vs V7, both OFF — clean model-vs-model.
- **Run B (verification evidence):** NB2 ON vs NB2 OFF — measures what verification catches on the new model and what it costs, which is exactly the deferred backlog-10 question, now on the model where it matters.
At ~$5–7 per run, the extra run costs less than the ambiguity it removes. Fix F7/F8 first or Run B measures broken plumbing.

**Is one bounded retry the right policy?** Yes, for now — with two caveats. (1) The budget derives from Netlify's 26s ceiling (verified-generation.ts:15-18), i.e. a proxy limitation is dictating guardrail policy; once generation is async (Part 3 §12) revisit with a latency budget, not a proxy budget. (2) The "extraction failed → `verified: true, conclusive: false`" path swallows the error entirely (bare catch, verified-generation.ts:62) — an inconclusive pass must be logged and counted, or verification silently degrades to theater.

**What constitutes a hard failure?** A structural fact violation on the final delivered image, confirmed by a human on judge/classifier flag: invented or deleted window/door, changed opening topology, wall/geometry restructure, camera relocation, ignored room boundary. Also hard: model returns no image, or returns an image the provider can't parse (F7). **Not** hard failures: infra/judging errors (API billing, parse failures) — those invalidate the run (exit 2, rerun), they don't count as skips or rejections; style weakness (that's the median check's job); curtain/soft-treatment changes (rubric already carves these out, correctly).

**What should block the model swap?**
1. Gate fixes: F1 (cross-mode baseline), F2 (validity wired in), F3 (min-n), judge model into config (F6, the cheap part).
2. F7 (all-parts image parsing) + F8 (mime) — these can produce spurious failures or corrupt verification on NB2.
3. Re-judged V7 baseline via `--eval-only` (F5).
4. Run A PASS.
5. Minimal generation telemetry (F14's one log line) so the flip is observable and reversible on evidence.

**What should NOT block it?** Auth/security (F13 — blocks *production exposure*, not the swap), Netlify timeout (F12 — same), sandbox decomposition, doc sync, archive of legacy pipelines (hard-dated Oct 2, do it in parallel), gate v2 catalogue cases, V8's NB2 story (route V8 traffic — currently zero — or accept it stays on old model until superseded), AGT extraction model replacement (measure it — F9 — but the extraction model isn't the one being shut off Oct 2; verify its own EOL date and schedule separately).

**Is V8 correctly scoped to catalogue-first?** Directionally yes — but hold the conclusion loosely: the entire V8 gate run was session-judged (F5), so "V8 under-transforms in style-only flows, baseline won 10/12" is provisional evidence. Re-confirm via `--eval-only`. Deeper problem: V8's *actual mission* (catalogue fidelity) has never been measured because the gate has no catalogue cases (F15) — V8 is currently scoped by what it's bad at, not proven at what it's for. And it can't run NB2 (F10). Recommendation: don't invest in V8 as a standalone pipeline; treat it as the structural core of V9 (which the plan already intends) and give V9 the catalogue gate cases V8 never had.

**Is V9 task-profile routing the right next investment?** The design is right — composition layer, deterministic classification first, `TaskProfile` as data, `full_redesign` byte-identical to V8 as rollback contract. Two sequencing corrections: (1) V9 after migration is correct (plan agrees — blocked by 13); (2) **gate v2 must precede V9 code**, not follow it — building scope-lock prompts before `scope_compliance` can be measured repeats the exact "shipped without regression proof" failure mode this whole phase exists to end. Also the plan's own expected gain ("15–30% scope-bleed reduction") is currently unfalsifiable — no scope-bleed baseline measurement exists.

**Hidden dependencies before migrating to NB2:**
1. F7 part-parsing (the sleeper — smoke test passing once proves nothing about part ordering under load).
2. F8 mime assumption.
3. F9 AGT extraction: unmeasured accuracy, EOL-family model, and NB2 *outputs* as re-extraction inputs are a new distribution.
4. F10 V8/catalogue path has no NB2 story.
5. F11 legacy anchors die Oct 2 — after that date you can never re-generate historical comparisons; if you want a frozen visual reference of old-model behavior, the existing run outputs in `runs/` are it — preserve them.
6. F24 ledger/runs live only in the main checkout — decide where the ledger canonically lives before it anchors promotion decisions (recommend: commit `ledger.jsonl` to git; it's append-only JSONL, it belongs in history).
7. Credits process: two P0 stalls from the same cause. Add a preflight credit/balance check to gate.py before any paid run (call the API once with a 1-token request, fail fast), and set a billing alert.

## 2.3 Corrected sequence

1. **Fix the gate** (F1, F2, F3, judge-model config) + **fix provider parsing** (F7, F8) + **one telemetry log line** (F14). ~1–2 days, $0.
2. **Top up credits** (with balance alert). Re-judge V7 baseline + V8 run via `--eval-only`; re-set baseline (F5).
3. **Run A**: NB2 vs V7, verifyAGT OFF, 3× repeats. **Run B**: NB2 ON vs OFF.
4. **Promote on Run A evidence**: flip `DEFAULT_IMAGE_MODEL` (make it env-overridable in the same change), watch telemetry, keep old model as env-rollback until Oct 2.
5. **In parallel with 3–4:** archive legacy pipelines (backlog 14, hard-dated), label fixtures + AGT extraction accuracy check (F9).
6. **Gate v2** (catalogue + scoped cases, scope_compliance/product_fidelity dimensions) → then V9 (backlog 15–17), folding V8.
7. Then quality tiers (NB Pro hero, FLUX spike) — unchanged, correctly last.

---

# PART 3 — FROM-SCRATCH IMPLEMENTATION PLAN

Informed by the repo: what follows is the system you'd build knowing everything V5→V8 taught. It is deliberately compatible with incremental migration (§13) — no big-bang rewrite is justified (the OPTIMIZE verdict stands).

## 3.1 Product goal

**The engine does:** given one photo of a real room, a style intent, and optionally a set of concrete products, produce a photorealistic rendering of *that room* renovated — same camera, same geometry, same openings, same architectural facts — with surfaces/finishes/fixtures/furnishings transformed and selected products faithfully installed. Every output is accompanied by machine-readable evidence of structural compliance.

**The engine refuses to (or flags when it cannot):**
- Invent or delete windows, doors, openings, or built-ins; move walls; change camera pose or room footprint.
- Render a product it cannot identify (bad catalogue data → explicit degradation to generic material, never silent).
- Deliver an output that failed structural verification without labeling it (`verification: failed` surfaced to the caller; the *product* decides whether to show it — per the PRD, consumer flows suppress, contractor/debug flows show with warning).
- Process non-room images, unusable inputs (too dark/small/occluded) — reject at intake with an actionable reason, per the Error-UX framework (no dead ends, no jargon).
- Guarantee dimensional accuracy or contract-grade specification — outputs are visualizations, not construction documents (disclaim in contract and UI).

## 3.2 Core user flows

| Flow | Path | Notes |
|---|---|---|
| **Basic restyle** (homeowner) | upload → intake validation → scene understanding + AGT → style profile → render brief → generate → verify → deliver | Style preset + influence; the V7 lineage |
| **Catalogue restyle** (contractor→homeowner) | same, plus: product selections resolved against contractor catalogue → products become primary brief anchors | The V8/V6 lineage; product fidelity scored |
| **Scoped edit** ("flooring only") | intent classified → TaskProfile → scope-lock brief (transform set + locked set) → stricter verification on locked scope | V9 lineage |
| **Contractor-facing** | authenticated tenant; catalogue management; lead capture; batch renders per listing; sees verification detail | Contractor identity is server-resolved, never a header |
| **Homeowner-facing** | anonymous-or-account; simple controls; failed verifications auto-retried then suppressed with "try a different style" framing | PRD §2.2: never show spatial violations |
| **Regenerate/retry** | same request id, new seed/attempt; history kept per session; re-anchor always against ORIGINAL upload, not previous output | Kills refinement drift (V7 spec deferred item) |
| **Failure explanation** | every failure maps to the Error-UX taxonomy: upload / generation / timeout / non-result / quality-suppressed; each with retry-edit-continue actions, inputs preserved | The framework exists in docs; build it into the API as typed error codes, not prose |

## 3.3 System architecture

Keep it two deployables (edge + service) plus workers; don't microservice a team-of-one product.

```
[Client(s)] → [Edge/API gateway: auth, rate limit, upload signing, job submit/poll]
                    │
             [Job queue  — Cloud Tasks / GCS-backed]      ← replaces the 26s sync proxy
                    │
[vis-service (Cloud Run)]
  intake/        image validation, downscale/transcode (HEIC→JPEG), room-photo classifier
  scene/         AGT extraction (+ future depth/segmentation)   ── pure I/O module, model-agnostic
  catalog/       product normalization, resolution, sanitization (trust boundary)
  brief/         RenderBrief construction (profiles × blocks — the ONLY prompt composer)
  providers/     image/text model registry, capability matrix, adapters
  verify/        re-extraction, diff, retry policy
  runs/          per-request run record persistence (the production ledger)
[eval/ (offline)]  gate, judges, case sets, ledger — same RenderBrief/verify code imported, not reimplemented
[storage]         GCS: uploads, outputs, run records; Postgres/Firestore: catalogues, sessions, ledger index
[admin/sandbox]   internal UI over the same public API + a debug-scoped API surface
```

Key inversions vs today: (1) generation is **async** (submit → job id → poll/webhook) — kills F12 and unlocks retries/hero-tier latency; (2) outputs and run records are **persisted server-side** — kills F14's amnesia; (3) the sandbox consumes the same API contract as production clients — kills the sandbox-hides-production-gaps class; (4) eval imports production modules — the judge tests what ships.

## 3.4 Data contracts (the load-bearing ones)

```ts
// -- VisualizationRequest (wire, replaces multipart soup) --
{
  requestId: string, tenant: { contractorId?: string },        // server-resolved, never client-asserted
  source: { imageRef: string },                                 // GCS ref from signed upload, not inline bytes
  intent: { task?: TaskKind, text?: string },                   // classifier input; task optional
  style?: { presetId?: string, influence: 0..100, custom?: {...} },
  products?: ProductSelection[],
  options: { verify: 'off'|'standard'|'strict', tier: 'standard'|'hero', regenerateOf?: requestId }
}

// -- SourceImageMeta -- { width, height, mime, bytes, exif: {orientation}, quality: {brightnessScore, blurScore}, roomPhotoConfidence }

// -- AGT (RoomFacts) — keep Rev1's design verbatim --
AGTField<T> = { value: T, confidence: 'high'|'medium'|'low' }
AGT = { windowCount: AGTField<number> & {instances: Box[]}, doorCount: ..., hasCeilingFixture: AGTField<bool>,
        hasBuiltInNiches: AGTField<bool>, cameraPerspective: AGTField<enum>,   // never hard
        overall: 'high'|'medium'|'low', uncertainFields: string[], extractorModelId: string, extractorVersion: string }

// -- StyleProfile -- { id, name, tierPressure: 'low'|'medium'|'high', surfaceMaterialMap?, conflictClauses?: string[],
//                      stagingDensity, negativeMotifs?: string[] }        // conflictClauses ON the registry entry (fixes F21)

// -- ProductSelection -- { productId, category: string /* open taxonomy */, role: 'primary'|'accent', placement?: RegionHint }

// -- CatalogueProduct -- see §3.11 (scraper contract)

// -- RenderBrief (the central artifact; fully serializable, hashable, replayable) --
{ briefId, briefVersion, profile: TaskProfile, blocks: [{ blockId, blockVersion, role, text }],
  images: [{ role: 'base'|'reanchor'|'product'|'moodboard', ref }],
  constraints: { hard: string[], advisory: string[] }, negative: string[],
  providerAdapterId, promptHash }

// -- ImageModelRequest -- { modelId, parts: NeutralPart[] /* {text} | {image:{ref|bytes,mime}} */, options: {candidates, seed?, conditioning?: {depth?, edges?, mask?}} }
// -- ImageModelResponse -- { images: [{bytes, mime}], text?: string[], finishReason, usage: {inputTokens, outputTokens}, latencyMs, raw?: providerBlob }

// -- VerificationResult -- { enabled, conclusive, attempts, violations: [{field, expected, observed, tier}],
//                            inconclusiveFields, outcome: 'pass'|'retried_pass'|'fail'|'inconclusive', reExtractorModelId }

// -- EvaluationResult (per case) -- { caseId, judge: {modelId, rubricHash, provenance: 'api'|'human'}, scores: {dim: 1-5}[both],
//                                     weightedScore, hardRejections: [], validity: {status, violations}, winner }

// -- RunLedgerEntry -- { timestamp, runId, gateVersion, judgeVersion, candidateMode, baselineMode, comparedAgainst: ledgerRef,
//                        casesEvaluated, casesRequired, repeats, hardRejectionsConfirmed, medianScore, perCase, verdict,
//                        acceptedBaseline, environment: {serviceGitSha, modelIds}, humanSignoff?: {who, when} }
```

Everything above is versioned (`briefVersion`, `blockVersion`, rubric hash, git sha in the ledger). The single biggest contract lesson from the repo: **identity must be explicit** — which model, which prompt blocks, which judge, which code produced this artifact. Today none of that is persisted.

## 3.5 Pipeline design — compose, don't fork

One pipeline. Zero version forks. The repo's 15 prompt folders and 14 modes are the cost of forking; V9's own plan already recognizes this.

```
resolve(request) → TaskProfile          // deterministic rules, then cheap LLM only if ambiguous
  → RenderBrief = compose(profile, AGT, style, products)   // block registry, canonical order ENFORCED (not `void`ed)
  → generate(brief, modelPolicy(profile, tier))
  → verify(policy(profile))             // strictness from profile
  → deliver | retry | suppress
```

The six "modes" become **profiles** (data) + **policies** (data):
- **Baseline restyle** = `full_redesign` profile, standard verify, flash-tier model.
- **Catalogue-first** = `product_install` profile: product anchors promoted to primary brief position (V8's real insight), material-fidelity emphasis, product_fidelity verification adds product-presence checks.
- **Scoped profiles** (`flooring_only`, `cabinet_only`, `wall_finish`, `lighting_only`, `minimal_edit`) = transform-set/locked-set pairs + scope-lock blocks + strict verify on locked scope.
- **Structural-preservation mode** = not a mode: it's `verify: 'strict'` + hard-constraint emphasis, available on any profile.
- **Hero mode** = same brief, different model policy (NB Pro / more candidates / mask-edit second pass), async-only.
- **Fallback mode** = degraded policy ladder, not a pipeline: primary model 5xx/timeout → same brief on fallback model → if verification fails twice → deliver best attempt flagged, or suppress per client class.

Version identity survives as **brief/block versions in the run record**, not as routing forks. "Freeze V5.1 as baseline" becomes "pin blockset hash X as the regression anchor" — reproducible without keeping nine dead service files alive (F11's lesson: frozen *code* rots when its model dies; frozen *briefs* replay on any model).

## 3.6 Prompt strategy

Layered brief, canonical order enforced by the composer (assert, don't `void`):

1. **System rules** (shared, versioned): photorealistic renovation of the provided room; explicit prohibition list; output-image-only.
2. **AGT constraints**: CONFIRMED FACTS (hard tier, "EXACTLY N windows") / STRUCTURAL OBSERVATIONS (advisory, "approximately N — preserve") — keep Rev1's tier→language map exactly; camera never hard.
3. **Scope block** (from TaskProfile): transform set / locked set ("ONLY the floor surface may change...").
4. **Product anchors** (catalogue): per-category apply/boundary/non-negotiable structure (current `renovation-anchors.ts` is good) — with sanitized descriptions (§3.11) and, where the provider supports reference images, the product image as a parts-level reference rather than words.
5. **Style transformation**: preset prose + surface-material map + staging density + conflict clauses (from the StyleProfile registry — fixing F21 so registered styles can carry them).
6. **Negative constraints**: style-specific anti-motifs + global anti-hallucination lines.
7. **Camera/geometry echo** (position N-1): restate hard facts only.
8. **Re-anchor image** (position N): the original room again — keep this V5-era trick; it demonstrably works.

**Retry prompts:** violation feedback appended as a corrective block (current `buildViolationFeedback` shape is right), plus explicit "attempt 2 of 2" framing.
**Provider adapters:** the composer emits neutral blocks; a per-provider adapter maps to wire format and applies provider quirks (part ordering, image limits, conditioning params, "no markdown in output" for models that chat). Prompt *text* stays provider-neutral; only the adapter is provider-specific. Tune per-model deltas as **block overrides keyed by (blockId, modelFamily)** — never as new prompt families.

## 3.7 Model/provider strategy

```ts
ProviderCapabilities = { imagesIn: number, refImages: boolean, maskEdit: boolean,
                         conditioning: ('depth'|'edges')[], maxOutputPx, costPerImage, p50LatencyMs }
registry: { 'gemini-3.1-flash-image' (NB2): workhorse — all standard traffic
            'gemini-3-pro-image'   (NB Pro): hero tier — final renders, mask-edit second pass, async only
            'flux-2-*+tools'       (spike): depth/canny conditioning — the only hard-geometry option; comparison mode first
            'gemini-2.5-flash-image': rollback floor until 2026-10-02, then delete }
```

- **Constants:** one `MODEL_POLICY` map (profile+tier → modelId), env-overridable per entry, defined in exactly one module. No hardcoded model ids anywhere else (today: `DEFAULT_IMAGE_MODEL` hardcoded, 9 legacy hardcodes, judge hardcoded).
- **Failover:** 429/5xx/timeout → bounded retry with backoff on same model → one attempt on fallback model (same family first) → typed failure. Failover events are first-class telemetry.
- **Capability-aware briefs:** composer asks the registry before attaching product reference images or conditioning; degrades to text anchors when unsupported.
- **Cost/latency/quality:** flash tier for interactive (~seconds, cents); pro/hero async (~tens of seconds, ~10× cost) gated to contractor deliverables and final exports; every response's `usage` + latency persisted per request (the migration telemetry F14 demands).
- **AGT extraction model** is a registry entry too (`text-extraction` role) with its own eval (§3.9) — never migrated implicitly.

## 3.8 Evaluation & regression strategy

- **Case corpus:** (a) 12 canonical style cases (keep); (b) 6+ catalogue cases (product sets from a fixture catalogue, including a product-photo mismatch case); (c) 6 scoped-edit cases (flooring/cabinet/wall × 2 rooms); (d) degraded-input cases (dark, cluttered, no-window, phone-HEIC); (e) synthetic geometry stress (many windows, mirrors, open-plan); (f) moodboard cases (resurrect the dormant suite's intent into the main harness). Each case carries human-labeled ground truth (window/door counts, product SKUs).
- **Metrics per case:** structural preservation (judge + validity classifier + **AGT diff as a deterministic third signal** — extraction on input vs output, free of judge noise); style transformation (judge, pressure-bucket aware); product fidelity (judge: product present/correct material/correct location, only on catalogue cases); scope compliance (only on scoped cases); defects.
- **Judging:** LLM judge (config-pinned model, rubric-hash-versioned, independent vendor from the generator — keep the "don't let Gemini grade Gemini" rule), images scored **independently per pipeline in separate calls** (kills anchoring/metadata bias), position-blind. **Human judging:** mandatory adjudication of every flagged hard rejection; ~20-verdict spot audit per promotion; quarterly judge-vs-human calibration on a fixed 12-pair set (track agreement; if it drifts, the judge version bumps and baselines re-anchor).
- **Hard rejection rules:** current 10-rule list is good; a rejection *counts* only when human-confirmed.
- **Thresholds (promotion):** 0 confirmed hard rejections; median drop ≤0.25 vs the **production mode's** accepted baseline (cross-mode, F1 fixed); no single case drops >1.0; n = full case set × 3 repeats; validity coverage 100%; judge provenance 100% API-or-human.
- **Ledger:** append-only JSONL, committed to git, entries per §3.4 including git sha + all model ids + `comparedAgainst` ref + explicit `humanSignoff` for baseline acceptance. Runs keyed by content, not directory mtime.
- **Promotion:** two-key — gate PASS (machine) + human sign-off recorded in the ledger. **Rollback:** criteria pre-declared at promotion time (e.g., verification-failure rate >X% over 48h, or any confirmed structural complaint), rollback = env flip, rollback event also ledgered.
- **CI:** preflight (static config/schema checks) on every PR — free; contract tests + block unit tests gate deploys (today deploy has no test gate, F23); paid gate runs are manual/scheduled, never auto-triggered, always preceded by a credit-balance preflight (the two P0 credit stalls justify this permanently).

## 3.9 AGT verification strategy

- **Pre-generation:** extraction on upload (parallel with user's style-picking, hiding latency — the specced-but-never-built `/api/agt` upload-trigger); Zod-validated JSON, hand-rolled parsing replaced; 800ms–2s timeout → FALLBACK_AGT; generation never blocks on AGT failure (keep).
- **Confidence tiers:** keep Rev1 exactly — enum not float, "prefer medium when uncertain," counts hard only when confidence=high AND instances match value, camera never hard, low=suppressed.
- **Extractor eval:** labeled fixture set (start with the 6 in `fixtures/`), measured per extractor-model: hard-fact precision (target ≥90% per spec), false-hard-fact rate (≤5%), tier distribution drift. Run whenever the extractor model or prompt changes. **This is the missing gate that makes AGT trustworthy as a verification instrument (F9).**
- **Post-generation:** re-extract from output (correct mime, F8), `diffAGT` semantics kept verbatim (hard-only violations; low-confidence output = inconclusive; boolean removal violates, addition allowed).
- **Diffs that matter:** window/door count changes, opening/built-in deletions, camera relocation. **Acceptable:** additions of booleans (fixture added by style is legitimate), advisory-tier drift, anything the input extraction wasn't confident about.
- **Policy:** violation → 1 corrective retry (standard) or 2 (strict/hero, async only) → keep best attempt → if still violating: consumer flows suppress + auto-regenerate framing; contractor/debug flows deliver flagged. Inconclusive → deliver + log + count (never a silent pass — today's bare-catch is the anti-pattern, F-detail in verified-generation.ts:62). Reject (never deliver) only on confirmed hard violation in consumer flow after retries.
- **Surfacing:** admin/debug shows extraction JSON, tier assignment, diff table, per-attempt images side-by-side, violation feedback text; production run record stores `VerificationResult` always, even when OFF ("enabled: false") so the flag flip has a before/after dataset.

## 3.10 V9 task-profile routing

Adopt the plan's design (it's good) with corrections:

- **Classification:** deterministic first — flooring selection→`flooring_only`; selections w/o style→`product_install`; preset-only→`full_redesign`; furniture image→`furniture_injection`; regex/keyword pass on text for "only/just/keep everything else" → scoped candidates. LLM classifier (flash text tier) **only** for ambiguous free text, output constrained to the enum, decision logged with rationale. Misclassification defaults *conservative*: when unsure, `full_redesign` (broad transform) is safer than a wrong scope-lock (user sees "it changed more than I asked" vs "it ignored me" — the former is the established product behavior).
- **TaskProfile** (data, in shared types): `{ task, transformScope: SurfaceRegion[], lockedScope: SurfaceRegion[]|'all_except_transform', constraintEmphasis: 'geometry'|'material_fidelity'|'item_identity', agtStrictness: 'standard'|'strict', personaLine? }` — as specced in backlog 15.
- **Per-profile deltas:** each profile changes exactly four things — scope/emphasis blocks in the brief, verification strictness + which diffs matter (e.g., `flooring_only` treats any non-floor material shift as scope bleed), judge dimensions applied (`scope_compliance` only for scoped), and model policy (minimal_edit may prefer mask-edit-capable NB Pro).
- **Profiles:** `full_redesign` (byte-identical brief to the pre-V9 composer — contract-tested rollback guarantee, keep this idea), `surface_restyle` (all surfaces, furniture locked), `flooring_only`, `cabinet_only`, `wall_finish`, `lighting_only`, `product_install` (catalogue-first, absorbs V8), `furniture_injection`, `minimal_edit` (single-object swap; strictest lock; hero/mask-edit preferred).
- **Sequencing:** gate v2 (scoped cases + scope_compliance dimension + a measured scope-bleed baseline on current V7) **before** any V9 prompt work — otherwise the claimed 15–30% improvement is unfalsifiable.

## 3.11 Catalogue / web-scraper contract

The scraper feeds a **catalogue ingestion service**, never the render path directly. Two-schema design: scraped input → normalization → curated `CatalogueProduct` (only the latter reaches briefs).

```ts
ScrapedProduct (input, lenient) = {
  sourceUrl: string,            // required — provenance + dedup key component
  contractorId: string,         // required
  name: string,                 // required
  rawCategory: string,          // required, free text
  description?: string, imageUrls?: string[], material?: string, finish?: string, color?: string,
  dimensions?: string, sku?: string, price?: Money, scrapedAt: ISO, scraperVersion: string }

CatalogueProduct (canonical, strict) = {
  productId, contractorId, name,
  category: string,             // OPEN taxonomy: canonical slugs (flooring, walls, countertops, cabinets,
                                // lighting, plumbing_fixtures, hardware, tile, appliances, ...) + categoryConfidence
  material: CanonicalMaterial, finish?: CanonicalFinish, color?: CanonicalColor,   // normalized vocab + confidence each
  renderDescription: string,    // GENERATED (LLM) from fields, 15-25 words, then SANITIZED (see below)
  images: [{ url|ref, kind: 'product'|'swatch'|'installed', usable: bool, width, height }],
  confidence: 0..1,             // aggregate ingestion confidence
  status: 'active'|'needs_review'|'rejected', dedupKey, provenance: { sourceUrl, scrapedAt, scraperVersion } }
```

- **Image requirements:** ≥512px shortest side, product-dominant frame; `swatch` preferred for surfaces, `product` for fixtures; unusable images don't block ingestion (text anchoring degrades gracefully) but cap `confidence`.
- **Normalization:** category and material/finish map through explicit vocab tables + LLM fallback with confidence; below-threshold → `needs_review`, never silently guessed into the render path.
- **`renderDescription` is generated, not scraped** — this removes today's hand-curation bottleneck (F20) — and is **sanitized**: length-capped, imperative/instruction phrases stripped, no negations of system rules, validated against an injection blocklist before it can ever enter a prompt. Scraped text is data, not instructions.
- **Dedup:** `hash(contractorId + normalized(name) + sku?)` + image perceptual-hash assist; re-scrapes update in place with provenance history.
- **Bad data handling:** missing required → rejected with reason (scraper feedback loop); conflicting fields (name says oak, material says laminate) → `needs_review`; dead image URLs → mark unusable, keep product; whole-catalogue anomalies (90% one category) → quarantine batch.
- **Render anchoring:** selection resolves `CatalogueProduct` → anchor block gets `renderDescription` + category rules; if provider supports reference images and a usable `swatch|product` image exists, attach it as a parts-level reference (the unused `imageUrl` finally earns its keep); `role: primary` products get the V8-style brief-lead position; low-confidence products render with a UI caveat ("representative material shown").
- **Compatibility today:** current `renovationSelectionIds` (4-category map) remains as a degenerate client of `ProductSelection[]` during migration.

## 3.12 Deployment & operations

- **Env/config:** one typed config module, fail-fast at boot with named missing vars. `IMAGE_MODEL_DEFAULT`, `IMAGE_MODEL_HERO`, `AGT_EXTRACTION_MODEL`, `MODEL_POLICY_OVERRIDES(json)`, `GEMINI_API_KEY` (rename from bare `API_KEY`), `ANTHROPIC_API_KEY` (eval only — not in prod service), `CORS_ORIGIN` (no wildcard default in prod), `DEBUG_RESPONSE_ALLOWLIST`.
- **Secrets:** GCP Secret Manager → Cloud Run secret mounts (not `--set-env-vars` from CI shell, F23); Netlify env for edge secrets; no key material transits CI logs.
- **Cloud Run:** min instances 0–1, concurrency tuned to memory (image buffers), request timeout 300s (async workers), multi-stage distroless/alpine image, non-root, `npm ci`, healthcheck wired to `/health`, readiness separate from liveness.
- **Netlify function:** thin auth + job-submit/poll only (26s is fine for submit/poll; never for generation). Token caching for OIDC (today: fresh token per request). Long-poll or client polling for results; images delivered as signed GCS URLs, not base64 JSON.
- **Timeouts:** per-model-call 60s (generation) / 10s (extraction) with AbortSignal; job-level budget per tier (standard 120s, hero 600s).
- **Retries:** provider 429/5xx → 2 retries exponential+jitter; verification retry per §3.9; job-level 1 requeue on worker death.
- **Rate limits/cost controls:** per-IP and per-tenant limits at edge; daily spend budget per environment with hard stop + alert; per-request cost computed from usage and stored; anonymous traffic capped tightly (today an unauthenticated endpoint spends Gemini money, F13).
- **Logging/tracing:** structured JSON, one canonical event per stage (`intake`, `agt`, `brief`, `generate`, `verify`, `deliver`) sharing `requestId`; Cloud Trace spans across Netlify→service→provider; prod level `info` (today's `warn` hides everything, F14). Error reporting to Sentry/GCP Error Reporting with taxonomy codes.
- **CI/CD:** PR → typecheck + unit + contract tests + preflight (no paid calls) → merge → deploy staging → smoke (1 real generation against staging) → manual promote to prod. Paid regression gate: manually triggered workflow with credit preflight; promotion = gate PASS + human sign-off recorded in ledger; rollback = env flip, ledgered.

## 3.13 Migration plan (current repo → §3 architecture)

**Immediately (this week, before any paid run):**
1. Gate fixes — F1 cross-mode baseline + NO_BASELINE=FAIL, F2 validity wiring, F3 min-n, judge model to config. (`tests/regression/gate.py`, `run_regression.py`, `config.gate.yaml`)
2. Provider parsing — F7 all-parts scan + F8 mime threading, with unit tests. (`models/providers/gemini.ts`, `guardrails/verified-generation.ts`)
3. One structured generation log line (F14). (`pipelines/core/pipeline-dispatcher.ts` or the model client)
4. Credit preflight in gate.py + top up credits.

**Stabilize (weeks 1–2):**
5. `--eval-only` re-judge of V7 baseline + V8 run; re-set baseline with human sign-off entry.
6. Run A (NB2 vs V7, OFF, 3×) → promotion decision; Run B (ON vs OFF on NB2).
7. On PASS: make `DEFAULT_IMAGE_MODEL` env-overridable and flip; keep 2.5-flash as env rollback until Oct 2.
8. Label fixtures; AGT extractor accuracy check for current + successor extraction model (F9).

**Delete/archive (before Oct 2, parallel):**
9. Backlog 14 as specced: move `pipelines/legacy-services/` (9 handlers) + legacy prompt families (~3,500 lines) to `archive/`, out of tsconfig; drop their modes from schema/routing/dispatcher; keep `baseline_original` + `balanced_v5` only if re-pointed at the shared client — otherwise archive them too and pin their historical run outputs as the visual reference. Fix `config.full_matrix.yaml` refs first (plan already warns).
10. Delete committed `dist-test/`, `web-sandbox/dist/` (gitignore both); delete dead params (`geometryPreservation`, `phaseAnchoring*`), unused density blocks, `ItemFidelityMode`; fix or delete the stale routing test and `tsconfig.contract-tests.json` ghosts; compute the contract count in `runContracts.ts`.

**Refactor (weeks 3–6, each protected by tests first):**
11. Single mode registry (one source for Zod enum + routing + types — F18); same for category taxonomy.
12. Rename `GeminiPart` → neutral part type at the composer/provider boundary; move `extractGeminiError` into the provider (F-leakage).
13. `StyleObject` gains `conflict_resolution`/`tierPressure` (F21); style substitution made explicit (log when registry overrides client).
14. Async job pattern for generation (§3.12) — the prerequisite for verifyAGT ON in production and for hero tier.
15. Auth + tenancy: signed requests at Netlify boundary, server-side contractor resolution, `debug` behind allowlist (F13).

**Leave alone:** prompt block text for V5/V7 (frozen, regression-anchored); `diffAGT`/`classify.ts` semantics; `renovation-anchors.ts` structure; the canonical composer's image-twice pattern; the rubric's carve-outs (curtains etc.).

**Protect by tests before changing:** request assembler (style substitution, verifyAGT parse, mode precedence), extract.ts parsing, verified-generation attempt selection, catalogue resolver rejection paths, controller error mapping — all currently untested (backend audit §10).

**Split into modules:** App.jsx (877 lines) → api-client / upload / mode+style form / catalogue panel / compare view / debug panels — opportunistically during V9 UI work per backlog 20; add `verifyAGT` toggle + `balanced_v7_nb2` option to the sandbox *now* (it can't exercise two shipped features, trivial fix).

**Document:** collapse PLATFORM_STATUS + CURRENT_STATE ×2 + AGENT_HANDOFF into one status doc with a "last verified against code" stamp; update ARCHITECTURE.md §8/§10/§11 (v6 alias, gate philosophy, provider layer); record the human-judging→automated-gate philosophy change explicitly.

**Move out of the sandbox:** nothing product-critical lives only there today (good); keep it that way — new admin/debug features go behind the API, sandbox stays a client.

## 3.14 Risks and open questions

1. **Can NB2 match old-model structural preservation?** Unknown — the only NB2 evidence is one smoke image. Mitigation: Run A with repeats; per-case floor threshold; rollback env until Oct 2. Watch specifically: window mullion/aspect fidelity (known old-model weakness per V7 spec deferred list — NB2 could be better *or* differently bad).
2. **Is AGT extraction reliable enough to gate on?** Never measured (F9). Until the labeled-fixture eval exists, treat verification as advisory telemetry, not a delivery gate. Extraction on *generated* (stylized) outputs is a different distribution than photos — re-extraction reliability needs its own check.
3. **Can LLM judging be trusted for promotion?** With independence fixes (F6), repeats, validity cross-check, and human adjudication of flagged rejections — yes, for *relative* regression detection. Not yet calibrated against human absolute judgment; the quarterly calibration set (§3.8) is the answer. The current V8 conclusion rests entirely on session judging — treat as unconfirmed.
4. **Does catalogue-first prompting reduce general style transformation?** The V8 data says yes (baseline won 10/12 on style-only) — but that data is session-judged. If re-judging confirms, the V9 composition answer (scope/product blocks only when relevant) is the fix; if it doesn't confirm, V8's demotion was premature.
5. **Are 12 cases enough?** For style-only model swaps with repeats: adequate. As the *company's* quality instrument: no — catalogue and scoped flows are the business differentiators and have zero coverage (F15).
6. **Is the sandbox hiding production integration problems?** Yes, actively: Netlify 26s timeout (gate bypasses it), CORS invalid combo (masked by same-origin), no auth (masked by obscurity), HEIC/size limits (masked by curated fixtures), base64 transport cost. §3.12 addresses each.
7. **Are provider differences abstracted correctly?** No — parts[0] parsing (F7), PNG assumption (F8), GeminiPart as the "neutral" type, Gemini errors in the controller. Fixable at the seams listed; the registry shape itself is right.
8. **Product-fidelity ceiling:** text-only anchoring ("15-20 word description") may cap catalogue realism regardless of pipeline; reference-image anchoring (NB Pro multi-ref, FLUX) is the likely unlock — that's the real justification for backlog 18/19, not "quality tier" abstractly.
9. **Single-maintainer process risk:** two P0 stalls from credit exhaustion; docs drift within a single day of shipping; tests exist but aren't run. Mechanize what can be mechanized (credit preflight, CI test gate, doc-check in PR template); the gate itself is the main defense.
10. **Web-scraper contract is greenfield** — nothing exists in-repo. §3.11 is the proposed contract; confirm integration shape (API vs shared schema vs repo) with the scraper project before building connective code.

## 3.15 Final recommendation

**Verdict:** OPTIMIZE, confirmed. The repo is better than the average AI-pipeline codebase of this vintage: real prompt factoring, a genuinely well-designed AGT tier system, a pure diff module, a working (if flawed) eval harness with an append-only ledger, and honest docs culture even where stale. The rot is concentrated and known: forked legacy pipelines, an eval gate with four decisive holes, provider assumptions that Gemini 3.x will break, and zero production hardening.

**Rebuild?** No. Every §3 target is reachable incrementally from the current tree; §3.13 is the path. The only "rebuild-shaped" work is the async job pattern and auth — additive, not rewrites.

**Promote NB2?** Not now — **after specific evidence**: fixed gate (F1–F3, judge config) + fixed provider parsing (F7, F8) + re-judged V7 baseline (F5) + Run A PASS with repeats. That is roughly one week of unblocked work plus two paid runs (~$30–40 total). The Oct 2 deadline leaves ~13 weeks; there is no schedule pressure that justifies promoting on a gate that cannot fail.

**Next 5 engineering actions, in order:**
1. **Fix gate decisiveness** — cross-mode baseline (`--baseline-mode`, default `balanced_v7`), NO_BASELINE→FAIL, `min_cases_evaluated: 12`, validity classifier wired into the verdict, judge model+version into config. Files: `tests/regression/gate.py:102-115,154-163,196-197`, `tests/regression/run_regression.py:453,516,637-668`, `tests/regression/config.gate.yaml`.
2. **Fix provider response handling** — scan all candidates/parts for inline image data, return + thread actual mimeType into re-extraction; unit tests for interleaved text+image responses. Files: `apps/vis-service/src/models/providers/gemini.ts:36,54`, `apps/vis-service/src/guardrails/verified-generation.ts:30-32,62`.
3. **Add generation telemetry** — one structured log per generation `{reqId, mode, modelId, latencyMs, attempts, verificationOutcome}`; persist model id in debug for V5/V8 (only V7 records it today). Files: `pipelines/core/pipeline-dispatcher.ts`, `models/image-model.client.ts`.
4. **Top up credits (with a gate-side balance preflight), re-judge via `--eval-only`** — V7 baseline (3 session-judged cases + 24 validity ERRORs) and the V8 run; re-accept the V7 baseline with sign-off; then execute **Run A** (NB2 vs V7, verifyAGT OFF, 3× repeats) and **Run B** (NB2 ON vs OFF).
5. **On Run A PASS: flip the default** — make `DEFAULT_IMAGE_MODEL` env-overridable and set it to `gemini-3.1-flash-image` (file: `models/image-model.client.ts:10`), keep 2.5-flash as rollback env until Oct 2 — and start backlog 14 (archive legacy pipelines) in parallel, which is hard-dated regardless of promotion.

**First files to open:** `tests/regression/gate.py` → `models/providers/gemini.ts` → `guardrails/verified-generation.ts` → `models/image-model.client.ts` → `config.gate.yaml`.

---

# ADDENDUM (2026-07-02, same day) — This repo is the R&D testbed; production lives in `reform-ai`

**Context from Chuck:** Visualization_Engine is the sandbox where models/pipelines are tested. The winning pipeline will **replace the visualization service in the `reform-ai` repo (reform ai inc org)** — the actual product. That repo was not accessible from this machine at review time (gh token has no org access; no local clone found).

**Verified locally:** the original production service (`C:\Users\cjlea\AI-Projects\reform-ai-image-visualization-service`, the same code snapshotted in `archive/Visualization_Engine_Baseline`) hardcodes `gemini-2.5-flash-image` (src/services/geminiService.ts:45). If reform-ai's current visualization service descends from it — very likely — **production itself breaks on October 2, 2026**, independent of anything in this sandbox. The EOL deadline is a production outage date, not a sandbox chore.

## What this changes

**Re-rated findings (this repo is not the production surface):**
- F12 (Netlify 26s), F13 (auth/CORS/debug exposure), F23 (CI without tests) — downgrade from "production blockers" to a **do-not-inherit checklist for the port**, plus verification questions against reform-ai's actual service. Residual risk here: the sandbox's Cloud Run endpoint is still publicly reachable via the Netlify URL and spends real Gemini money — worth a cheap shared-secret, but not urgent.
- F1–F9 (gate + provider + AGT-measurement) — unchanged or **elevated**: the gate is now the instrument that decides what ships to actual production. It must be decisive before it picks the winner.
- Part 3 (§3.1–3.15) reads as the **design spec for the new visualization service inside reform-ai**, not a rebuild of this repo. §3.13's "refactor" phase applies to whichever codebase hosts the service going forward.

**The port becomes the schedule-critical item.** Corrected top-level sequence:
1. Fix gate + provider here (unchanged, §2.3 steps 1–3).
2. Run A/B → pick the winner (model + pipeline + verify policy).
3. **Port the winner into reform-ai** — this is the real "migration," and it must land before Oct 2. Port unit: the responsibility-organized modules (`pipelines/`, `prompts/blocks/`, `guardrails/`, `models/` provider layer, `catalog/` resolver) plus the request/response contract — not the transport shell, not the sandbox, not this repo's Netlify/CI scaffolding.
4. This repo remains the eval harness: give `run_regression.py` a `--base-url` so the gate can run against reform-ai's deployed service as the port's acceptance test (today it only auto-starts localhost:8080 — runtime_config.py).
5. V9 should probably be built directly in the ported service, not here — avoid porting twice.

## CONFIRMED (2026-07-02, verified against `ReformAI-Inc/Reform-AI` origin/main via the local clone at `C:\Users\cjlea\reformai`)

Access resolved: the `reformai-admin` gh account (already configured on this machine) has org access. Verified from `origin/main` (fetched; local working tree untouched — it sits on `feat/visualization-material-extraction`, 70 commits behind).

1. **Production breaks Oct 2 — confirmed.** `apps/api/src/config/visualization.config.ts:11` defaults `VISUALIZATION_SERVICE_URL` to `https://reform-ai-image-visualization-service-646800391584.europe-west1.run.app` — the original baseline service, which hardcodes `gemini-2.5-flash-image` (verified in its source at `src/services/geminiService.ts:45`). Same GCP project as the sandbox service, different service + region.
2. **The contract is drop-in compatible.** `apps/api/src/services/visualization.service.ts:161-295` posts multipart `roomImage` (buffer or URL-fetched), `moodBoardImages`, `furnitureImage`, `previousResultImage`, `roomType`, `stylePreset` (JSON), `textPrompt`, `styleInfluence`, `isRefinement` — exactly the new vis-service's assembler contract — and consumes the response as `response.data.data.image`, the new service's shape. It sends **no `mode`**, so it would land on the default pipeline (`balanced_v7`, NB2 after the flip). Quirk: it injects a placeholder `stylePreset.imageUrl` "to satisfy GCP service validation" (line 258-262) — harmless against the new schema (imageUrl optional, registered styles substituted anyway).
3. **Separate deployments — sandbox is NOT production.** Production calls the old `europe-west1` service; the sandbox's Netlify fn targets `reform-ai-vis-…us-central1`. Sandbox deploys are safe.
4. **No 26s problem in production, and no auth today.** `apps/api` (itself Cloud Run, `southamerica-east1`, deployed via `.github/workflows/deploy-api-prod.yml`) calls the vis service with **timeout 120s + 2 retries** (`visualization.config.ts`) and **no auth header** (plain axios/fetch; health probe fetches the bare base URL) — the old service is publicly invokable. So: verifyAGT ON is latency-feasible in production, and the Netlify-26s constraint is sandbox-only. Caveat: `maxRetries: 2` on a generation POST means a slow-but-successful render can be paid for up to 3×.
5. **No catalogue flow in production yet** — no `renovationSelectionIds`/`X-Contractor-Id` sent; V6/V8 catalogue features are unexercised by the product. The org also hosts `ReformAI-Inc/web-scraper` — the §3.11 ingestion contract should target Reform-AI's storage (drizzle/Postgres in `apps/api`), not the sandbox's in-memory registry.

## Revised migration mechanics: the "port" is a CUTOVER

Because production already treats visualization as an external microservice with a compatible contract, replacing it is not a code port:

1. Promote NB2 in the sandbox repo (gate fixes → Run A/B → flip default) — unchanged.
2. **Cutover = flip `VISUALIZATION_SERVICE_URL`** in Reform-AI's api env to the new service. Rollback = flip it back (until Oct 2).
3. **Auth decision before cutover:** the new `reform-ai-vis` Cloud Run is private (the sandbox Netlify fn mints OIDC tokens); production calls unauthenticated. Either (a) *right way:* grant apps/api's service account `roles/run.invoker` on `reform-ai-vis` and add ID-token minting to `HttpClient` (trivial on Cloud Run via metadata server / google-auth-library), or (b) allow unauthenticated on the new service and inherit the old posture (weak — F13 notes apply). Choose (a).
4. **Acceptance:** run the (fixed) gate with `--base-url` against the new service URL as production sees it, pre- and post-cutover.
5. Also in Reform-AI, same EOL family: `apps/api` material-extraction uses `gemini-2.5-flash` / `gemini-2.5-flash-lite` (`gemini.config.ts`) — env-overridable, but verify those text models' shutdown dates separately.
6. Post-cutover: decommission the old `europe-west1` service before Oct 2; then vis-service (this repo's `apps/vis-service`) *is* the production visualization service, and §3.12's hardening (auth, async jobs, telemetry) becomes its production backlog for real.
