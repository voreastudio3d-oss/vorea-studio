# Paperclip Operator Guide for Vorea

Date: 2026-04-03

## Purpose

Paperclip is the control plane for Vorea work.

Use it to:
- decide priorities
- create and refine issues
- assign work to the right agent
- review outputs, blockers, and next steps
- schedule recurring reviews

Do not think of Paperclip as the place where the product work itself happens.
Think of it as the operating room where you direct work and review what the agents produce.

## Company Prefix

Vorea is mounted under the company prefix `EMP`.

Main board root:
- `http://localhost:3100/EMP/dashboard`

Useful board URLs:
- Dashboard: `http://localhost:3100/EMP/dashboard`
- Goals: `http://localhost:3100/EMP/goals`
- Project list: `http://localhost:3100/EMP/projects`
- Main project: `http://localhost:3100/EMP/projects/92b22cea-e605-4803-81ab-17cf651d2cd6`
- Issues: `http://localhost:3100/EMP/issues`
- Agents: `http://localhost:3100/EMP/agents/all`
- Org chart: `http://localhost:3100/EMP/org`
- Routines: `http://localhost:3100/EMP/routines`
- Activity: `http://localhost:3100/EMP/activity`

## What You Should Do In The Board

### 1. Work from issues, not from memory

Your normal entry point should be:
- `EMP/issues`

What you do there:
- create new issues when a real task appears
- improve titles and descriptions so the ask is precise
- set priority
- connect the issue to the right goal/project
- assign the issue to the right agent

Good issue pattern:
- one concrete objective
- clear context
- expected result
- acceptance criteria

### 2. Use goals to keep direction stable

Use:
- `EMP/goals`

What you do there:
- review if the company is pointed at the right outcomes
- keep top goals stable
- avoid using goals for tiny tasks

Right now the two most important Vorea directions are:
- scaling the product with Paperclip
- marketing and user growth as an explicit initial front

### 3. Use the project page as the operating hub

Use:
- `EMP/projects`
- then open `Vorea Parametrics 3D`

What you do there:
- review the repo-connected project
- inspect its issues
- inspect linked workspace context
- confirm which work belongs to this product

### 4. Use agents as owners, not as magic bots

Use:
- `EMP/agents/all`
- `EMP/org`

What you do there:
- check who owns what
- wake an agent manually only when needed
- inspect runs, logs, and blockers
- avoid waking everyone randomly

Current operating team:
- CEO: Cerebro Vorea CEO
- CTO: Vorea CTO
- CMO: Vorea CMO
- Research: Vorea Researcher
- AI Studio Engineer
- Monetization Engineer
- Relief / 3MF Engineer

### 5. Use routines for weekly cadence

Use:
- `EMP/routines`

Current routines:
- Weekly growth review and next actions
- Weekly technical execution review

What you do there:
- keep them paused until you are ready for recurring automatic execution
- unpause when the rhythm is wanted
- inspect generated runs and recurring output quality

## Where You See Results

### Issue detail

This is the most important result surface.

Open an issue and expect to see:
- comments with summaries
- status changes
- linked documents such as plans
- approvals if needed
- live runs and active execution context

If you want to know "what happened?", start from the issue.

### Agent detail

Open:
- `EMP/agents/<agent>`

Use it to inspect:
- current status
- recent runs
- logs
- instructions
- what the agent is configured to do

If you want to know "how this agent behaves?", start from the agent page.

### Activity

Open:
- `EMP/activity`

Use it to inspect:
- cross-company movement
- recent state changes
- who touched which entity

If you want a quick pulse, start here.

### Routines

Open:
- `EMP/routines`

Use it to inspect:
- whether a recurring review fired
- whether it created a useful output
- whether it should stay active or be adjusted

## What Results To Expect

### Good results

Healthy Paperclip output usually looks like:
- an issue moved forward or closed
- a blocked issue with a clear blocker and owner
- a short written summary of what changed
- a plan document linked from the issue
- subissues created when a large task was decomposed correctly

### Bad results

Intervene when you see:
- vague generic summaries
- no concrete next step
- repeated blocked comments with no new context
- issues with no assignee
- agents being manually woken without a task
- work happening outside a project/goal

## Recommended Working Loop For You

### Daily loop

1. Open `EMP/dashboard` or `EMP/activity`
2. Open `EMP/issues`
3. Review critical and high priority items first
4. Open the few issues that really matter today
5. Reassign, clarify, or comment where needed
6. Wake a specific agent only if there is a concrete issue to move

### Weekly loop

1. Review `EMP/goals`
2. Review `EMP/projects/Vorea Parametrics 3D`
3. Review `EMP/routines`
4. Check whether marketing/growth and technical execution are both moving
5. Create or archive issues based on what changed that week

## The Best Way To Use Me Alongside Paperclip

Ask me to operate the control plane when you want structured changes such as:
- "Create 3 child issues under EMP-5"
- "Assign EMP-10 to AI Studio Engineer"
- "Rewrite EMP-7 with better acceptance criteria"
- "Unpause the weekly growth routine"
- "Summarize what the CMO produced today"
- "Turn this document into Paperclip issues"
- "Which issue should the CTO do next?"

Ask me for strategic help when you want better direction such as:
- "What should be the next growth priority?"
- "Which agent should own this?"
- "How should we decompose this backlog item?"
- "What should I review in the board today?"

## Best Practice For Manual Use

Prefer this order:
- create or refine the issue
- connect it to the correct goal/project
- assign it
- only then wake the agent if needed

Avoid this order:
- wake an agent first
- then decide what you wanted

## Current Runtime Note

As of 2026-04-03:
- Paperclip is healthy on `http://localhost:3100`
- the Docker runtime permission issues were fixed
- Codex auth was seeded into the Paperclip container from the local machine's `.codex` session
- the Vorea repo is mounted inside the Paperclip runtime at `/projects/vorea`

This means agent execution is now viable again, but the best results will come from issue-driven work inside the `EMP` board, not from random manual wakes.
