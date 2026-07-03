# ReformAI Visualization Engine — Lessons Learned

[2026-06-11] | Anthropic credits exhausted mid-judging, stalling two P0 items | Check API credit balance before launching any paid eval run; add automated preflight to gate.py
[2026-06-11] | Provisional 9-case baseline entered ledger alongside corrected 12-case entry | Enforce min_cases_evaluated in the gate; never accept a baseline below full case count
[2026-07-02] | Gate auto-PASSes any new candidate mode via NO_BASELINE (V8 passed at median 3.975 vs 4.425) | Never trust a gate that hasn't been shown it CAN fail; new-mode comparisons must be cross-mode against the production baseline
[2026-07-02] | verifyAGT ON was planned for the NB2 promotion run, confounding model change with verification change | One variable per experiment: promotion runs compare like-for-like; measure verification value in a separate ON-vs-OFF run
[2026-07-02] | Stale tests (pipeline-routing.test.ts asserts pre-alias behavior) and hardcoded "21/21" contract count went unnoticed | Tests that aren't run in CI are documentation that lies; wire npm test into the deploy workflow
[2026-07-02] | Docs drifted within one day of shipping (PLATFORM_STATUS missing nb2/verifyAGT on the day they shipped) | Doc sync belongs in the definition-of-done of the change itself, not a separate backlog item
[2026-07-03] | Bookkeeping branch created from a stale origin/main (fetched pre-merge) silently rolled the worktree back to pre-archive file state; main survived only because squash-merge diffs against the merge-base | Always `git fetch origin` immediately before `git checkout -b <branch> origin/main`; in worktrees, remember main can never be checked out directly — bookkeeping goes via fresh branch + PR
