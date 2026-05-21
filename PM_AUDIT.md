# PM Audit: Harbor Eval Studio
## Perspective: Task Author Who Wants to Ship Hard Evals Fast

---

### What the user actually wants

A Harbor task author needs to:
1. Pick a real-world workflow where AI models fail in interesting ways
2. Formulate WHY the model fails (weakness hypothesis)
3. Prove it fails (probe/sweep with data)
4. Package it as a reproducible Harbor task pack
5. Ensure the task is "hard" (pass@3 = 0) and "fair" (oracle = 1, nop = 0)
6. Ship it

### What the current app does well
- The 5-stage pipeline (Intake > Probe > Build > Validate > Publish) is correct
- The ds-25 demo walkthrough teaches the Harbor task format
- Tool calls show real work happening (list workspace, write artifact, etc.)
- Spoiler lint is genuinely useful - catches leaky instructions
- The audit step (different model judges the failure) prevents verifier bugs

### Where the app falls short (beyond LLM wrapper)

#### 1. NO VISIBILITY INTO WHAT MAKES A GOOD TASK
The user has zero guidance on what makes a Harbor task "hard" vs trivially passable.
The taxonomy exists in code (8 failure modes!) but is completely hidden from the UI.
A user should be able to BROWSE failure modes and see example tasks for each.

#### 2. NO TASK QUALITY DASHBOARD
There's no aggregated view of task health. You get individual results but no
"scoreboard" showing: oracle=1? nop=0? target pass@3? spoiler lint clean?
All 4 must be green before publishing. This should be a prominent checklist.

#### 3. PIPELINE IS RIGID, NOT ADAPTIVE
The pipeline assumes linear flow. But task authors iterate constantly:
- "The probe says promote, but I want to tighten the bait first"
- "I changed the instruction, need to re-sweep"
- "Oracle is failing, verifier has a bug"
The UI should show what's stale after changes, not just what stage you're on.

#### 4. NO ARTIFACT DIFF TRACKING
When the agent rewrites instruction.md, the old version is just gone.
Task authors need to see WHAT CHANGED and WHY. Version history per artifact.

#### 5. THE REAL VALUE: FAILURE MODE LIBRARY
The biggest value beyond an LLM wrapper would be a curated library of
failure mode templates. Each template includes:
- The weakness pattern (e.g., "models trust portal exports over dependency traces")
- Example bad heuristics the model uses
- The authority invariant the verifier checks
- Starter fixtures and instruction templates
This turns "blank page anxiety" into "pick a pattern and customize."

#### 6. TASK HEALTH CHECKLIST IS THE KILLER FEATURE
Instead of a linear pipeline, the real mental model is a CHECKLIST:
  [ ] Weakness hypothesis documented
  [ ] Probe failure rate > 80%
  [ ] Instruction written (spoiler-lint clean)
  [ ] Fixtures generated
  [ ] Oracle sweep = 1
  [ ] Nop sweep = 0
  [ ] Target sweep pass@3 = 0
  [ ] Trajectory audited (not environment_failure)
  [ ] No stale results after latest edits

This checklist should be THE main view, not buried in results.

---

### Implementation Plan

1. Add failure mode picker to intake stage
2. Add task health checklist to briefing/overview
3. Add staleness tracking to results
4. Surface taxonomy in the UI as a browsable reference
