---
name: new-project
description: Scaffold a new interactive project for the portfolio. Use when adding a new simulation, visualization, or demo project.
argument-hint: [project-id]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Scaffold a new project with id `$ARGUMENTS` for the portfolio. Follow these steps exactly:

## 1. Check if the project exists in the registry

Read `js/projects/registry.js` and check if the project id already has an entry in the `PROJECTS` array.

- If it exists with `status:'planned'`, you'll upgrade it to a live project.
- If it doesn't exist, ask the user for: title, subtitle, category (control/software/math/data), tags, short description, and full description. Then add the entry to the `PROJECTS` array.

## 2. Create the project file

Create `js/projects/$ARGUMENTS.js` following the pattern used by existing projects (e.g., `cart-pole.js` or `double-pendulum.js`):

- Use an IIFE: `(function(){ ... })();`
- Define `render(container)` and `cleanup()` functions
- Call `ProjectRegistry.register('$ARGUMENTS', render, cleanup)` at the end
- Set up canvas, animation loop, controls panel, and cleanup logic
- Use the existing engine modules (rk4, physics, metrics) where applicable

## 3. Add the script tag

Edit `index.html` to add a `<script src="js/projects/$ARGUMENTS.js"></script>` tag in the `<!-- Projects -->` section, after the existing project scripts.

## 4. Summary

Tell the user what was created and suggest next steps (implementing the physics model, adding controllers, etc.).

## Architecture notes

- All rendering is vanilla JS — no frameworks
- Simulations use `requestAnimationFrame` loops
- Physics uses RK4 integration from `js/engine/rk4.js`
- Controllers live in `js/controllers/` and are shared across projects
- The design system uses CSS variables from `css/main.css` — use classes like `sim-wrap`, `panel`, `ctrl`, `btn`, `metric`, etc.
- Two-column layout: `.two-col` with `.sidebar` for controls
- Cleanup must cancel animation frames and destroy Chart.js instances
