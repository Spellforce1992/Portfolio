---
name: project-status
description: Show an overview of all portfolio projects, their status, and what needs work. Use to get a quick picture of the portfolio state.
allowed-tools: Read, Glob, Grep
---

Generate a status overview of the portfolio by reading `js/projects/registry.js` and checking each project's implementation.

## For each project, report:

1. **Status** — live / wip / planned (from the registry)
2. **Has render function** — check if `ProjectRegistry.register('id', render, cleanup)` exists in the project file
3. **Controllers used** — which controllers does it integrate (PID, LQR, etc.)
4. **Engine modules used** — RK4, physics, metrics, vectorfield, matrixui
5. **Missing pieces** — what's needed to go from current state to complete

## Output format

Use a compact table:

| Project | Status | Controllers | Engine | Notes |
|---------|--------|------------|--------|-------|

Then list 2-3 suggested next steps for the portfolio overall (e.g., "implement robot-arm to add a 3D project" or "add MPC controller to differentiate from existing demos").
