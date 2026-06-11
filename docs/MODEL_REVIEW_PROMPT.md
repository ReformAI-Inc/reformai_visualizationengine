# Model Review Prompt — Optimize vs. Rebuild

Copy the block below and hand it to a fresh model for a cold technical review of
the Visualization Engine.

---

```
You are a senior systems architect doing a cold, honest technical review of an
existing codebase. I need a real verdict, not reassurance. Your job is to decide
ONE thing and defend it with evidence: should we keep optimizing the current
Visualization Engine, or rebuild it from scratch?

## What the project is
ReformAI Visualization Engine. It takes a photo of a room and transforms it into
a photorealistic redesign in a chosen interior-design style using Google Gemini
(gemini-2.5-flash-image). Inputs: a base room photo, a style preset, optional
moodboard reference images, optional user furniture items to inject, and a user
text request.

The defining tension of the whole system: the model must TRANSFORM the room
(materials, furniture, palette, lighting) while simultaneously PRESERVING it
(windows, walls, camera angle, architectural geometry). A secondary tension is
multimodal ambiguity — multiple input images with no inherent signal telling the
model what each one is for. Every version of this system (baseline through V8) is
a progressively more elaborate attempt to resolve those two tensions reliably.
Most of the engineering intelligence lives in PROMPT ARCHITECTURE (constraint
tiers, image-role labeling, structural sandwiches) plus an "AGT" guardrail layer
that extracts/classifies architectural ground truth before generation.

## Read these first, in this order (do not skip)
0. docs/MODEL_REVIEW_PROMPT.md — this brief itself; re-read it as your charter
1. ARCHITECTURE.md — the full why, baseline → V8, every decision and what failed
2. docs/PLATFORM_STATUS.md — current authoritative runtime, paths, routing
3. docs/LESSONS_LEARNED.md and docs/EXECUTIVE_SUMMARY.md
4. apps/vis-service/README.md — request flow + validation commands
5. apps/vis-service/src/ — especially:
   - pipelines/ (routing, core composer, versions/ — note v5/v6/v7/v8)
   - prompts/ (the ~15 versioned prompt families + blocks/shared)
   - guardrails/ (AGT extraction/classification)
   - models/, catalog/, contracts/, transport/
6. apps/web-sandbox/ — the comparison sandbox UI
7. tests/ — regression, moodboard_regression, bedroom_regression, visualization_ab

Then form your own view of the actual code, not just the docs. Where the docs and
the code disagree, trust the code and flag the drift.

## What I want you to assess
- Architecture health: Is the pipeline/prompt/guardrail layering coherent, or has
  it accreted? There are ~15 prompt-version folders and many legacy/archived
  pipelines still in-tree. How much is load-bearing vs dead weight?
- The core approach itself: Is "resolve the transform-vs-preserve tension via ever
  more elaborate prompt engineering + a pre-extraction guardrail" the right
  long-term strategy, or is it fighting the model? Would a different architecture
  (e.g. masking/inpainting, depth/segmentation conditioning, ControlNet-style
  structural conditioning, a different model, multi-pass compositing) resolve the
  root tension more reliably than prompt discipline ever can?
- Maintainability & velocity: Can a new engineer ship a change safely? Is the
  versioning/governance model (canonical v7, comparison v6, frozen benchmarks)
  helping or trapping the team in a comparison museum?
- Testing/validation: Is the regression philosophy sound and is coverage real?
- Risk: single model dependency, no eval harness for output quality, etc.

## Deliver
1. A one-line verdict: OPTIMIZE or REBUILD.
2. The 3–5 pieces of evidence that most drove that verdict (cite files/paths).
3. If OPTIMIZE: the highest-leverage changes in priority order, with rough effort
   and what each unblocks. Be specific about what to delete, merge, or freeze.
4. If REBUILD: what to keep vs discard (the prompt/constraint knowledge is likely
   the real asset — say so if true), a target architecture, a migration path that
   doesn't lose the hard-won failure-mode learnings, and the cost/risk of rebuild
   vs the cost/risk of continuing.
5. The strongest argument AGAINST your own verdict, and why you rejected it.

## Rules of engagement
- Be blunt. If the architecture is over-engineered for what it delivers, say so.
  If it's actually sound and just needs cleanup, say that too — don't manufacture
  a rebuild to sound bold.
- Ground every major claim in something you read. No generic advice.
- Distinguish "the approach is wrong" from "the approach is right but the code is
  messy" — those lead to opposite verdicts.
- Don't trust the version numbers as progress. Confirm that later versions
  actually beat earlier ones, and tell me how that's even measured today.
```

---

## Optional add-on — if the reviewing model can run the engine

If the model has API access and can actually generate outputs (not just read the
code), append this to the prompt:

```
## Additionally — exercise the system, don't just read it
- Run the validation commands in apps/vis-service/README.md and report pass/fail.
- Run the regression sets under tests/ (regression, moodboard_regression,
  bedroom_regression, visualization_ab) and judge the ACTUAL outputs against the
  transform-vs-preserve goal — not whether the code executes.
- For at least one room, generate with balanced_v7 vs an earlier version (e.g.
  balanced_v5) on the same input and tell me whether the "newer is better" claim
  holds up in the images themselves.
- Report whether any objective output-quality eval harness exists. If not, treat
  its absence as a first-class finding.
```
