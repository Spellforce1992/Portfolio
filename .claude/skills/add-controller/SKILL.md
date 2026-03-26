---
name: add-controller
description: Add a new controller algorithm to the portfolio. Use when implementing a new control strategy (MPC, sliding mode, fuzzy, etc.).
argument-hint: [controller-name]
allowed-tools: Read, Write, Edit, Glob, Grep
---

Add a new controller named `$ARGUMENTS` to the portfolio. Follow these steps:

## 1. Study existing controllers

Read `js/controllers/pid.js` and `js/controllers/lqr.js` to understand the interface pattern. Controllers should expose a consistent API that projects can use.

## 2. Create the controller file

Create `js/controllers/$ARGUMENTS.js` with:

- A constructor/factory that accepts configuration parameters
- A `compute(state, setpoint, dt)` method (or equivalent) that returns the control output
- A `reset()` method for reinitializing state
- Clear documentation of what state variables it expects
- Use `window.ControllerName = ...` to make it globally available (matching the existing pattern)

## 3. Add the script tag

Edit `index.html` to add `<script src="js/controllers/$ARGUMENTS.js"></script>` in the `<!-- Controllers -->` section.

## 4. Summary

Tell the user:
- What the controller does and its tuning parameters
- Which projects it could be integrated with
- How to wire it up in a project's render function
