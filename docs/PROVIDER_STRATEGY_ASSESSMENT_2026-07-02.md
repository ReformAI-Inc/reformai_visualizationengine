# Should ReformAI Keep Betting on Gemini? — Provider & Architecture Assessment

**Date:** 2026-07-02
**Role:** VP of AI Engineering assessment for CEO/board decision
**Horizon:** 3–5 years
**Method:** Deep-research workflow (104 agents, 22 sources, 106 extracted claims, 25 adversarially verified: 13 confirmed 3-0/2-1, 1 refuted, 11 interrupted by session limits — of which 7 were subsequently verified directly against primary sources) + repo-verified internal facts.

**Evidence labels used throughout:**
- **[V]** verified claim (adversarial 3-vote panel or direct primary-source fetch)
- **[B]** benchmark result (linked)
- **[P]** public information (announcement/docs; not independently adversarially verified)
- **[I]** engineering inference (my reasoning; could be wrong)
- **[R]** recommendation (my position)
- **[?]** unverified / data does not exist — stated as such

---

## Executive summary (the answer)

**Stay on Gemini as the primary generation engine — but stop treating "Gemini vs. not-Gemini" as the strategic question. The strategic question is "prompt-constrained vs. geometry-conditioned," and the evidence says geometry-conditioning is where structural preservation actually comes from.**

Concretely: promote NB2 as the workhorse (forced by EOL, justified by benchmarks), adopt NB Pro for hero/product renders (it leads the one benchmark that measures what we care about), and fund the FLUX.2 depth-conditioned lane as a first-class strategic experiment rather than a curiosity — because every serious production player in our vertical that we could find evidence for (Zillow/VSAI, Beike, RoomGPT) chose geometry-conditioned or hybrid architectures over raw foundation-model prompting, and the only rigorous head-to-head we found (Autodesk) showed unconditioned frontier models — including Google's best — silently reinventing room geometry.

No wholesale provider switch is justified. OpenAI's LMArena lead is real but comes with ~5× latency, no geometry conditioning, and no demonstrated structural-preservation advantage. Ideogram and Recraft are not fit-for-purpose. Self-hosting is not justified below ~500k generations/month for a team this size.

---

# PART 1 — Market landscape

## Google (incumbent)
- **gemini-2.5-flash-image** (Nano Banana): our production model. **EOL Oct 2, 2026** (repo-verified fact). Ranks **#20 on LMArena Image Edit, Elo 1295** [B: https://arena.ai/leaderboard/image-edit, verified 3-0].
- **gemini-3.1-flash-image** (NB2): our code-complete target. **#6 on LMArena Image Edit, Elo 1387** — ~92 Elo above what we run today, and within 1 point of NB Pro's 2K variant (#5, 1388) [B: same source, verified 3-0]. Latency ~850ms average per one third-party API benchmark — the fastest of the frontier editors tested [P: atlascloud.ai blog; single-source, not adversarially verified].
- **gemini-3-pro-image** (NB Pro): **#1 of 16 frontier editors on GEditBench v2, Elo 1096**, ahead of ByteDance Seedream 4.5 (1089) and GPT Image 1.5 (1071) [B: https://arxiv.org/pdf/2603.28547, verified 3-0]. Note: one of two verification panels on the duplicate phrasing of this claim voted 1-2 (refuted) over version-labeling details; the confirmed phrasing pins the model version (26-03-04). Treat the ranking as solid, the exact version labeling as caveated.
- **Roadmap signal:** `gemini-3.1-flash-lite-image` (nano-banana-2-lite) added to LMArena leaderboards **June 30, 2026** [V: arena.ai changelog, fetched directly] — Google is actively expanding the exact family we're migrating to. Google's image-model cadence (2.5 → 3.1 in ~a year, three tiers) is the fastest of the majors [I].
- **Rate limits:** Google does **not** publish per-model RPM/TPM limits for image models; limits are project-specific in the AI Studio dashboard [P: ai.google.dev/gemini-api/docs/rate-limits via workflow fetch]. This is a real capacity-planning risk at 100k+/month scale — get written quota commitments before scaling [R].

## OpenAI
- **gpt-image-2 (medium)** is **#1 on LMArena Image Editing, Elo 1464**, ahead of all Gemini models [B: arena.ai, verified 3-0]. Its debut-day #1 on Artificial Analysis is **[?] unverified** — and the verification note found it listed at rank 13/82 there by July 2026, which mostly demonstrates that arena rankings are volatile.
- Pricing is token-based: gpt-image-2 $8.00/1M input, $30.00/1M output; gpt-image-1.5 $8/$32 [P: platform.openai.com/docs/pricing via workflow fetch]. Per-image cost depends on resolution/quality tier; comparable order of magnitude to Gemini at medium quality [I].
- Latency: ~4,200ms average in the same third-party benchmark — ~5× NB2 [P: atlascloud blog, single-source].
- **Provider-risk data point:** OpenAI is hard-shutting-down dall-e-2 and dall-e-3 on May 12, 2026 [P: OpenAI community/deprecation notice via workflow fetch]. Forced image-model EOL migrations are an industry-wide pattern, not a Google defect. Switching vendors does not escape EOL risk; abstraction does [I].
- No depth/edge conditioning, no mask-free structural guarantees [P: API docs].

## Black Forest Labs (FLUX)
- **FLUX.2** is a unified editing+generation family: "All variants of FLUX.2 offer image editing from text and multiple references in one model"; editing up to 4MP; **up to 10 reference images** with "the best character / product / style consistency available today" (their claim) [V: bfl.ai/blog/flux-2, fetched directly].
- **Structural conditioning** (canny edge / depth map) exists as a first-class documented capability: "maintain precise control during image transformations", explicitly "particularly effective for retexturing images" [V: BFL structural-conditioning docs, fetched directly]. **Retexturing-while-preserving-geometry is literally our product.**
- **Licensing:** FLUX.1 Canny/Depth [dev] + LoRAs are **FLUX.1-dev Non-Commercial License** — self-hosted commercial use requires a separate license or the paid API [V: same doc]. FLUX.2 [pro]/[flex] are commercial managed APIs from **$0.03/image** [P: docs.bfl.ai pricing via workflow fetch]. FLUX.2 [klein] is positioned as Apache 2.0; FLUX.2 [dev] is open-weight with a commercial-license option for self-hosting [P: BFL blog — **license terms must be re-verified before any self-host decision**].
- **Quality:** FLUX.2 [klein] 9B is the **top open-source editor on GEditBench v2 (#4 overall, Elo 1039)**, ~60 Elo behind NB Pro; the older FLUX.1 Kontext [dev] is near-last (15th, 869) [B: arxiv 2603.28547, verified 3-0]. The FLUX.2 generation is a step-change over FLUX.1 for editing [I from the same data].
- **Self-hosting cost:** FLUX.2-dev needs ~64GB VRAM BF16 (~32GB FP8) even with text-encoder offload — H100/RTX PRO 6000 class, not consumer GPUs [P: spheron.network guide via workflow fetch, single-source].

## ByteDance — **Seedream 4.5 is #2 on GEditBench v2 (Elo 1089)**, within noise of NB Pro [B: verified 3-0]. A genuine quality contender; enterprise procurement, data-governance, and geopolitical-risk questions make it a watch-list item rather than a candidate for us [I/R].

## Others (assessed, not recommended)
- **Ideogram, Recraft:** strengths are text rendering, brand/vector/design workflows [P: their docs]. **No evidence surfaced — from any source — of competitive photorealistic *editing* of existing room photos.** Not fit-for-purpose [I]. **[?]** No interior-editing benchmark data exists for either.
- **Midjourney:** no production API story compatible with our pipeline; editor is consumer-oriented [P]. Out.
- **Stability:** SD3.x/ControlNet ecosystem remains the open-source conditioning workhorse baseline, but GEditBench-class instruction-editing leadership has moved to FLUX.2/Qwen [B/I].
- **Adobe Firefly:** enterprise licensing/indemnification story, editing quality for this vertical unproven publicly **[?]**.
- **Qwen-Image-Edit-2511:** Elo 1038 on GEditBench v2, effectively tied with FLUX.2 klein as open-source leader [B: verified 3-0]; also depth-conditionable per the Autodesk test [V]. The credible self-host alternative if that ever becomes necessary.
- **Runway/Luma:** video-first; not evaluated for still-photo renovation editing **[?]**.
- **Open-source gap:** best open models trail the best proprietary by ~60 Elo on GEditBench v2 [B: verified 3-0]; ImgEdit-Bench authors (NeurIPS 2025) attribute the lag to training-data quality [B: github.com/pku-yuangroup/imgedit, verified 3-0]. The gap is closing generation-over-generation [I].

---

# PART 2 — Architectural alternatives

**The decisive evidence of the whole research effort** is Autodesk's controlled test of next-gen models on architectural viewer scenes [V: all four claims verified 3-0/2-1, https://aps.autodesk.com/blog/do-you-still-need-controlnet-testing-next-gen-models-viewer-scenes]:

1. Google's Nano Banana (Pro-class), given screenshot + text prompt **without** conditioning: "the stair geometry shifts, railing styles change, and the spatial proportions are reinterpreted... it's no longer *your* design."
2. Their conclusion: "**Yes, you still need ControlNet** — if the output needs to respect the geometry of your design... 'better' without depth map constraints still means the model is free to reimagine your floor plan."
3. FLUX and Qwen **with depth conditioning**: "closely match the original layout... The depth map keeps walls, floors, and furniture where they belong."
4. Without depth/normal inputs, "the AI hallucinates — windows fill with nonsense, stairs vanish."

Scoring the options against that evidence:

| Option | Verdict |
|---|---|
| **A. Single foundation model** (what we do) | Ceiling-limited for structural preservation. Our AGT+prompt machinery is a text-space workaround for a geometry-space problem [I]. Right choice for v1 speed-to-market; wrong 5-year bet as the *only* mechanism [R]. |
| **B. Vision → plan → generate → verify** (what we actually built: AGT → prompt → NB → re-extract diff) | Best-in-class *prompt-side* discipline; keeps working regardless of provider. Keep it — it becomes the QA layer over any architecture [R]. |
| **C. Segmentation → region editing** | Proven in the vertical: an open-source virtual-staging pipeline (Grounding DINO + SAM + multi-ControlNet SD) preserves room geometry while staging [P: arxiv 2409.03198 via workflow fetch]. Best for scoped edits ("flooring only" = floor mask). Higher pipeline complexity [I]. |
| **D. Depth-conditioned editing** | The strongest structural-preservation evidence of any option (Autodesk [V]; BFL positions depth conditioning specifically for retexturing [V]). Adds one pipeline stage (monocular depth estimation) [I]. |
| **E. Object-aware editing** | Emerging (NB Pro partial mask-edit, FLUX Fill); best for product placement; not yet a whole-architecture answer [I/?]. |
| **F. Classical diffusion pipelines (self-hosted SD/ControlNet)** | Maximum control, maximum ops burden; what Beike built in-house (RoomDiffusion) with a dedicated team [P: workflow fetch]. Wrong for our team size now [R]. |
| **G. Hybrid** | **The answer.** Foundation model for full restyles (speed, quality, DX) + depth/mask-conditioned lane for structure-critical and scoped work + AGT verification over everything [R]. This is also what the market leaders converged on (Part 6). |

**Which architecture produces the highest-quality renovation visualizations?** On current evidence: **hybrid (G), with D as the structural backbone for scoped/structure-critical requests and A for full restyles** [R]. Single-model prompting alone demonstrably cannot guarantee geometry [V-backed].

---

# PART 3 — Provider scoring

Honest scoring requires saying **most cells have no public data**. No public benchmark measures flooring replacement, kitchen/bathroom renovation quality, furniture insertion, or product fidelity specifically **[?]** — GEditBench v2's visual-consistency judge [B] and ImgEdit-Bench's detail-preservation dimension [B] are the closest proxies. Scores below: ●●● strong / ●● adequate / ● weak / — no data. Sources: benchmarks above, official docs, Autodesk test, our own gate data where marked (internal).

| Criterion | Gemini NB2 | Gemini NB Pro | GPT Image 2 | FLUX.2 (pro/API) | Qwen-Edit (OSS) |
|---|---|---|---|---|---|
| Photorealism | ●●● [B arena] | ●●● [B] | ●●● [B] | ●●● [B GEdit] | ●● [B] |
| Structural preservation (unconditioned) | ●● (internal gate: V7 12/12 PASS on 2.5; NB2 unproven) | ●● [V Autodesk: reinterprets geometry] | — [?] | ●● | ●● |
| Structural preservation (conditioned) | n/a — no conditioning API | n/a | n/a | ●●● [V Autodesk] | ●●● [V Autodesk] |
| Prompt adherence / editing instr. | ●●● [B] | ●●● [B #1 GEdit] | ●●● [B #1 arena] | ●● [B] | ●● [B] |
| Interior design quality | — no public data; our gate is the measurement [?] | — | — | — | — |
| Product fidelity / reference images | ●● (multi-image parts) | ●●● (up to 14 refs [P]) | ●● | ●●● (10 refs [V]) | ●● |
| Mask editing / inpainting | ● | ●● (partial mask-edit [P]) | ●● (edit API masks [P]) | ●●● (Fill/Kontext [P]) | ●● |
| Depth/canny conditioning | — | — | — | ●●● [V] | ●●● (ControlNet) [V] |
| Segmentation support | — (via separate models) | — | — | ecosystem [P] | ecosystem [P] |
| Iterative editing / consistency | ●● | ●●● [B GEdit consistency] | ●● | ●● | ●● |
| Latency | ●●● ~850ms [P single-source] | ●● ~1,800ms [P] | ● ~4,200ms [P] | ●● (4-step klein fast [B]) | self-host dependent |
| Cost @1K image | $0.067 [V official] | $0.134 [V] | ~token-based, res-dependent [P] | from $0.03 [P] | GPU cost |
| API maturity / DX | ●●● (our SDK integration is live) | ●●● | ●●● | ●● | ● (self-host) |
| Rate limits transparency | ● (unpublished [P]) | ● | ●● | ●● | n/a |
| Enterprise readiness | ●●● (GCP, our stack) | ●●● | ●●● | ●● | ● |
| Licensing clarity | ●●● | ●●● | ●●● | ●● (mixed OSS licenses [V]) | ●●● (Apache-class) |
| Lock-in risk | ●● (mitigated by our registry) | ●● | ●● | ●● | ●●● (weights owned) |
| EOL/churn risk | proven churn (Oct 2 EOL) | same vendor | proven churn (DALL-E May 2026 [P]) | startup risk [I] | none (weights) |

**Text rendering, outpainting, commercial interiors, exterior renovations:** no relevant public evidence surfaced for any provider in our use case **[?]** — all four would need internal gate cases before any claims.

---

# PART 4 — Cost analysis

**Managed API, per-generation, 1K resolution, official prices [V: ai.google.dev/gemini-api/docs/pricing fetched 2026-07-02; P: BFL/OpenAI pages via workflow]:**

| Model | $/image | 100k/mo | 250k/mo | 500k/mo | 1M/mo |
|---|---|---|---|---|---|
| gemini-2.5-flash-image (today) | $0.039 | $3,900 | $9,750 | $19,500 | $39,000 |
| **NB2 @1K** | **$0.067** | **$6,700** | **$16,750** | **$33,500** | **$67,000** |
| NB2 @0.5K | $0.045 | $4,500 | $11,250 | $22,500 | $45,000 |
| NB2 @2K | $0.101 | $10,100 | $25,250 | $50,500 | $101,000 |
| NB Pro @1K/2K | $0.134 | $13,400 | $33,500 | $67,000 | $134,000 |
| FLUX.2 pro (from) | $0.03+ | $3,000+ | $7,500+ | $15,000+ | $30,000+ |
| gpt-image-2 | token-based; res/quality dependent — **do not plan on a single number without a measured pilot** [I] | | | | |

Key facts:
- **The NB2 migration is a ~72% unit-cost increase at 1K** ($0.039 → $0.067) [V]. At today's volumes this is noise; at 1M/mo it's +$28k/mo. Google's **Batch API halves image output cost** (2.5-flash-image batch $0.0195 [V]; NB Pro batch = half standard [V]) — contractor/listing pre-renders should move to batch [R].
- Blended realistic tier mix at 1M/mo (85% NB2-1K interactive, 10% batch, 5% NB Pro hero): ≈ $67k×0.85 + $3.4k + $6.7k ≈ **~$67k/mo** [I]. Add AGT extraction + verification re-extraction (flash text calls, sub-cent) ≈ +2–4% [I]. Verification retries add one generation per violating request only.
- **Self-hosting** (FLUX.2-dev or Qwen): needs H100-class (~64GB BF16 / 32GB FP8 [P]). Cloud H100 ≈ $2–4/hr ≈ $1.5–3k/mo/GPU [P: market rates, not adversarially verified]. Break-even vs managed API arrives somewhere in the 500k–1M/mo band *if* throughput per GPU is high enough — **throughput numbers for FLUX.2-dev at production quality do not exist publicly [?]; measure before believing any break-even claim** [R]. Hidden costs: MLOps on-call, model upgrades (FLUX.1→2 was a full requalification [B]), GPU capacity management, license fees for dev-tier commercial use [V/I]. **For a solo-engineer company: not before ~500k/mo sustained, and only with a hire** [R].

---

# PART 5 — Benchmarks (what exists, what doesn't)

| Benchmark | What it measures | Key result | Link |
|---|---|---|---|
| **LMArena Image Edit** (human prefs) | General editing preference | gpt-image-2 #1 (1464); NB Pro-2K #5 (1388); NB2 #6 (1387); **our current model #20 (1295)** [B verified 3-0] | https://arena.ai/leaderboard/image-edit |
| **GEditBench v2** (23-task, visual-consistency judge) | Instruction editing incl. **structure/identity preservation** | NB Pro #1 (1096); Seedream 4.5 (1089); GPT Image 1.5 (1071); FLUX.2 klein top-OSS (1039) [B verified 3-0] | https://arxiv.org/pdf/2603.28547 |
| **ImgEdit-Bench** (NeurIPS 2025 D&B) | Instruction adherence, editing quality, **detail preservation** | OSS lags proprietary (data-limited) [B verified 3-0] | https://github.com/pku-yuangroup/imgedit |
| **Autodesk viewer-scene test** (qualitative, controlled) | **Architectural geometry preservation** | Unconditioned frontier models reinvent geometry; depth-conditioned FLUX/Qwen preserve it [V 3-0 ×3, 2-1 ×1] | https://aps.autodesk.com/blog/do-you-still-need-controlnet-testing-next-gen-models-viewer-scenes |
| LMArena **Multi-Image Edit** category (since Jan 23, 2026) | Reference-conditioned editing — relevant to product anchoring | exists; standings not deep-read this pass [V category exists] | https://arena.ai/blog/leaderboard-changelog/ |

**What does not exist [?]:** any public benchmark for renovation-specific tasks (flooring swap, cabinet swap, window-count preservation, camera-pose fidelity, catalogue-product fidelity). The two arenas disagree on Google-vs-OpenAI ordering (different task mixes, judge protocols, and model vintages — GEditBench tested GPT Image **1.5**, the arena ranks GPT Image **2**). **Conclusion: public benchmarks bound the field but cannot make our decision. Our regression gate is the only benchmark that measures our product. This is why fixing the gate (per the 2026-07-02 repo review) precedes every provider decision** [R].

---

# PART 6 — What are companies actually using?

- **Zillow** — acquired **Virtual Staging AI** (Harvard Innovation Labs startup) in **Oct 2024**; its Sept 2025 "AI Virtual Staging" in Showcase is powered by VSAI. VSAI's approach: **generative models + 3D computer vision / geometry understanding** — not single-shot foundation prompting. [P: Zillow press releases — fetch was blocked (403) so labeled public-info; acquisition and launch corroborated by my own knowledge base. Verification votes were interrupted by session limits.] **The largest player bought a structure-aware specialist rather than renting a frontier API** [I].
- **Beike/Ke.com** (China's largest real-estate platform) — built **RoomDiffusion**, a from-scratch in-house diffusion model for interior design with its own data pipeline [P: workflow fetch of paper/report]. Evidence, not inference.
- **RoomGPT** (open-source consumer restyler) — built on **ControlNet** conditioning, not a foundation image API [P: github.com/nutlope/roomgpt via workflow fetch].
- **Academic/OSS virtual staging** — Grounding DINO + SAM + multi-ControlNet preserves geometry while staging [P: arxiv 2409.03198].
- **Houzz, IKEA (Kreativ), Planner5D, Homestyler, Coohom** — **no reliable public information surfaced [?]**. IKEA Kreativ is publicly known to use 3D scene reconstruction (informed inference from their product behavior [I]), but no architecture documentation was verified. Do not cite these in board materials beyond "unknown."

**Pattern [I]:** every player we have actual evidence for chose geometry-aware architectures (acquire, build, or condition). Nobody with a structural-preservation requirement is shipping raw foundation-model prompting at scale. We are currently the exception — our AGT layer is a lightweight compensator for that.

---

# PART 7 — What matters in 3 years

All of this section is **[I]** unless marked:

1. **Fastest improver: Google.** 2.5 → 3.1 in ~12 months, three-tier family, lite variant added June 30 [V], #1 on the consistency-aware benchmark [B]. Deepest multimodal research pipeline of the majors.
2. **OpenAI** wins general human preference today [B] but ships slower in image editing, at 5× latency [P], with the same EOL churn [P: DALL-E shutdown].
3. **BFL** owns the conditioning/control niche and the open-weights strategy; FLUX.2 klein closed most of the OSS gap [B]. Startup risk is real; mitigated by weights being self-hostable.
4. **ByteDance Seedream** is quietly at the quality frontier [B] — watch, don't adopt.
5. **Platformization:** image APIs are becoming platform products (Gemini API tiers/batch/refs; OpenAI images-in-responses). Expect **native geometry conditioning (depth/mask) to appear in foundation APIs within 1–2 years** — Google adding depth conditioning to a Gemini image model would collapse the main reason to run a second provider. **This is the single most decision-relevant thing to watch** [R].
6. **Open source** trails by ~60 Elo [B] and is closing; at our 3-year volume, a self-hosted Apache-licensed editor (FLUX.2-klein-class successor, Qwen successor) becomes a credible cost/lock-in hedge [I].

---

# PART 8 — Migration analysis

Baseline for all rows: our provider registry means "add adapter + re-run gate," not "rewrite." Prompt families are Gemini-tuned (repo fact); any provider change requires full gate re-baseline (fixed gate is a prerequisite for ALL of this).

| Path | Effort | Risk | Quality Δ (evidence) | Cost Δ @1K | Notes |
|---|---|---|---|---|---|
| **Gemini → NB2 (in-family)** | Trivial (done, unpromoted) | Low; gate must be fixed first (see repo review) | +92 Elo class on editing [B]; structural behavior unproven → Run A | +72% ($0.039→$0.067) [V] | The forced move. Do it. |
| **Gemini → OpenAI (wholesale)** | Moderate: adapter (~days), prompt retune (~weeks), full re-baseline | Medium-high | + on general editing [B]; **unknown on structure [?]**; −5× latency [P] | roughly comparable, res-dependent [P] | No conditioning; no structural case; **not justified** [R] |
| **Gemini → FLUX (wholesale)** | High: adapter + **depth-estimation stage** + prompt rewrite (diffusion prompting ≠ chatty multimodal) + re-baseline | High as wholesale | Best conditioned-structure evidence [V]; weaker instruction-following than NB Pro [B] | −45%+ (from $0.03) [P] | Wrong as *replacement*; **right as a lane** [R] |
| **Gemini → Ideogram** | Moderate | High | No editing evidence for our vertical [?] | n/a | **No.** Wrong tool [R] |
| **Gemini → Recraft** | Moderate | High | No editing evidence for our vertical [?] | n/a | **No.** Wrong tool [R] |
| **Gemini → Hybrid (Gemini primary + FLUX conditioned lane)** | Incremental: `providers/flux.ts` + depth stage + scoped-edit gate cases | Low (additive; rollback = registry) | Highest expected structural ceiling [V-backed] | Blended ≈ neutral | **Recommended** [R] |

Changes required for the hybrid (repo-specific): new provider module implementing the registry interface; neutral part-type rename (already flagged in repo review F-list); depth-map generation stage (monocular depth model — API or small self-host); `options.conditioning{depth,edges}` plumbing (already sketched in backlog 19); provider-keyed block overrides in the composer (never new prompt forks); gate v2 scoped-edit cases + `scope_compliance` dimension to measure it; verification unchanged (AGT diff is provider-agnostic — its whole value). Rollback everywhere = registry routing + env constants.

---

# PART 9 — Position (no hedging)

**Option 3+ (multi-provider through the existing registry) with a specific task map — Gemini remains the primary bet. Not Option 1 (pure Gemini monoculture), not Option 2 (switch), not Option 4 (don't build an orchestration *platform* — our registry, plus policy config, is enough), and Option 5's hybrid vision+editing architecture is adopted *incrementally* as the structure lane, not as a rebuild.**

| Task | Provider/model | Why |
|---|---|---|
| Vision understanding + AGT extraction | **Gemini 3 Flash (text)** | Current 2.5-flash is EOL-family [repo]; same-vendor multimodal, cheap ($0.50/$3.00 per 1M [V]); requires the extractor-accuracy eval from the repo review before swap |
| Workhorse generation (full restyle) | **NB2 @1K** | Forced + justified [B]; batch API for non-interactive [V pricing] |
| Hero / product-fidelity renders | **NB Pro** (up to 14 refs, partial mask-edit [P]) | #1 on the consistency-aware benchmark [B]; catalogue reference-image anchoring |
| Structure-critical + scoped edits ("flooring only") | **FLUX.2 [pro] + depth conditioning** as challenger lane | Only managed-API hard-geometry mechanism [V]; graduates to default for scoped profiles only if it beats NB2 on scoped gate cases |
| Verification re-extraction | Gemini 3 Flash now; evaluate one non-Google VLM later for independence [I] | Pragmatism now; "don't let Gemini grade Gemini" already governs eval judging [repo] |
| Eval judging | **Anthropic** (existing rule) | Judge independence from generator vendor [repo] |
| Segmentation (V9+ scoped masks) | SAM-class OSS, self-hosted or via API | Commodity, cheap, no lock-in [I] |

**Why not switch to OpenAI despite #1 LMArena?** The lead is on general editing preference, not architectural structure [?]; 5× latency [P] breaks interactive UX; token pricing complicates unit economics; and they exhibit identical EOL churn [P]. Switching vendors buys a different flavor of the same risk while forfeiting our Gemini-tuned prompt families and GCP integration.

---

# PART 10 — 12-month roadmap (dependency-ordered)

**Phase 0 — Make the ruler honest** (dependency for everything)
- Objective: a gate that can actually fail a candidate. Deliverables: cross-mode baseline, validity-classifier wiring, min-n, repeats; provider parsing fixes (parts scan, mime); telemetry log line. (Fully specified in REPO_REVIEW_AND_REBUILD_PLAN_2026-07-02.)
- Risks: none material. Validation: re-judged V7 baseline; gate FAILs a sabotaged candidate in a drill. Success: promotion decisions carry API-judged, repeatable evidence.

**Phase 1 — NB2 promotion + production cutover** (dep: P0; hard-dated re Oct 2)
- Run A (NB2 vs V7, verifyAGT OFF, 3×) → promote → flip sandbox default → Reform-AI `VISUALIZATION_SERVICE_URL` cutover with run.invoker auth → decommission old service. Run B (ON vs OFF) decides verification default.
- Risks: NB2 structural regressions (mitigation: per-case floor threshold, env rollback until Oct 2); unpublished Gemini rate limits (mitigation: request written quota).
- Success: production on NB2 ≥2 weeks, verification-failure telemetry flat, zero structural complaints.

**Phase 2 — Measure what the product actually is** (dep: P0)
- Gate v2: catalogue cases + scoped-edit cases + `scope_compliance` + `product_fidelity` dimensions; labeled-fixture AGT extractor eval; extractor migration off 2.5-flash.
- Success: scope-bleed and product-fidelity baselines exist for V7/NB2 — the yardstick for Phases 3–5.

**Phase 3 — FLUX.2 depth-conditioned lane** (dep: P2 — without scoped metrics the spike is unmeasurable)
- `providers/flux.ts`, depth-map stage, conditioning plumbing, provider-keyed block overrides. Run scoped-edit gate: FLUX+depth vs NB2.
- Risks: new vendor (human approval, per plan); prompt-style mismatch; depth-estimator quality on amateur photos.
- Validation: ≥15% scope-bleed reduction AND zero AGT hard violations on scoped cases, else the lane stays experimental. Success metric: scoped-edit structural-violation rate vs NB2, measured, ledgered.

**Phase 4 — V9 task-profile routing + NB Pro hero tier** (dep: P2, P3 informs model policy)
- V9 composition layer (per existing backlog 15–17) with per-profile model policy: full_redesign→NB2, product_install→NB Pro (refs), scoped→winner of P3. Catalogue reference-image anchoring via NB Pro multi-ref vs FLUX 10-ref challenger [V capability].
- Success: task-profile routing live; product-fidelity score gains on catalogue gate cases; hero tier priced into contractor plans (batch where async).

**Phase 5 — Volume economics + independence review** (dep: P1 traffic data; calendar ~month 9–12)
- Re-price at actual volume; move batchable traffic to Batch API (−50% [V]); if sustained >500k/mo, run a *measured* self-host throughput pilot (FLUX.2/Qwen successor) before any hire/commitment; re-verify all model EOL dates; check whether Gemini API has shipped native conditioning (if yes, re-run P3 comparison on it).
- Success: $/render at P95 volume known and defended; documented go/no-go on self-hosting with measured numbers, not blog claims.

---

# Final board answer

**"Should ReformAI continue betting on Gemini, or pivot?" — Continue betting on Gemini as the primary engine through at least mid-2027, executed as a multi-model strategy behind the abstraction we already built, with one strategic hedge: stand up the depth-conditioned FLUX lane and let our own gate — not arena leaderboards — decide whether geometry conditioning becomes the backbone of scoped editing.**

The honest structure of the argument:
- **Proven facts:** our model is EOL Oct 2 [repo]; production Reform-AI runs on it [repo]; NB2 is code-complete [repo]; official prices as quoted [V]; FLUX conditioning exists, is retexturing-oriented, with mixed licenses [V].
- **Benchmark results:** NB2 ≈ +92 Elo over current on LMArena editing [B]; NB Pro #1 on GEditBench v2 [B]; gpt-image-2 #1 on LMArena [B]; OSS −60 Elo [B].
- **Public info:** Zillow bought a geometry-aware specialist [P]; Beike built in-house [P]; OpenAI EOLs models too [P]; NB2 latency advantage [P, single-source].
- **Engineering inference:** prompt-space structural control is ceiling-limited; the vertical converges on geometry-aware hybrids; foundation APIs will absorb conditioning within ~2 years.
- **Recommendation:** stay + hedge, as specified in Part 9; revisit the whole question if (a) Gemini ships native depth conditioning (bet strengthens), (b) FLUX lane beats NB2 decisively on scoped structure (hedge widens into a lane), or (c) Google's image roadmap stalls for two consecutive releases (bet weakens).
- **Uncertainty we must close experimentally, not by more reading:** NB2's structural behavior on *our* rooms (Run A), scoped-edit scope-bleed baselines (gate v2), FLUX-with-depth on amateur photos (P3 spike), real throughput/economics of self-hosting (P5 pilot). No public source can answer these; the gate can.

*Research provenance: deep-research workflow wf_fe3e7d43-9a6 (104 agents; verification partially interrupted by session limits at ~8pm reset — 7 interrupted claims subsequently verified directly against primary sources; Zillow claims remain public-info-grade due to a 403 on the press page; GPT Image 2 debut-rank claim remains unverified and is flagged wherever used).*
