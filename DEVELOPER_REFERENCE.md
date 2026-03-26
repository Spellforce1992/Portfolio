# DEVELOPER REFERENCE — Joshua Nierop's Portfolio

> This document is the single source of truth for AI-assisted development.
> It describes every file, every interaction, every convention.
> Read this before modifying any code.

---

## 1. PURPOSE OF THE SITE

A portfolio website for Joshua Nierop, a control-oriented mechanical engineer.
The site showcases **interactive control systems simulations** that run real physics
and real control algorithms in the browser — not just animations, but tools where
users can adjust parameters and observe the effect on closed-loop performance.

**Two audiences:**
1. **Hiring managers / engineers** — see the project cards, interact with demos, read the CV.
2. **Joshua himself** — a growing library of control demos he can reference and extend.

**Key design principle:** Each project has two modes:
- **Playground** — free experimentation. User adjusts physics, switches controllers, tunes gains.
- **Control design method** — a guided walkthrough showing how an engineer would actually
  design a controller step by step (linearize, check controllability, choose weights, solve
  Riccati, simulate, evaluate metrics).

---

## 2. FILE STRUCTURE

```
Portfolio/
├── index.html                          # SPA shell, script load order
├── css/
│   └── main.css                        # Complete design system (light + dark)
├── js/
│   ├── router.js                       # Hash-based SPA router
│   ├── app.js                          # Page renderers (Home, Projects, About, CV, Contact)
│   ├── engine/
│   │   ├── rk4.js                      # Runge-Kutta 4th order integrator
│   │   ├── physics.js                  # PhysicsSystem base class + DoublePendulum + CartPole
│   │   └── metrics.js                  # Control performance metrics (settling time, SSE, etc.)
│   ├── controllers/
│   │   ├── pid.js                      # PID controller with anti-windup
│   │   └── lqr.js                      # LQR controller with algebraic Riccati equation solver
│   └── projects/
│       ├── registry.js                 # Central project configuration array
│       ├── double-pendulum.js          # Double pendulum project (playground + design)
│       ├── cart-pole.js                # Cart-pole project (playground + design)
│       ├── robot-arm.js               # 3-DOF robot arm project (FK/IK, Three.js 3D)
│       ├── fusion-demo.js             # Isotope ratio control project (FF+PI, LQR, MIMO)
│       └── grid-shift.js             # Cyclic grid puzzle with backtracking solver
└── assets/                             # Images, CV PDF (currently empty)
```

---

## 3. SCRIPT LOAD ORDER (CRITICAL)

Scripts are loaded synchronously in `index.html` in this exact order:

```
1. CDN: numeric.js (1.2.6)     — matrix ops, eigenvalues, ODE solver
2. CDN: Three.js (r128)        — 3D rendering (used by robot-arm project)
3. CDN: Chart.js (4.4.1)       — real-time response plots
4. js/engine/rk4.js            — RK4 integrator → window.RK4
5. js/engine/physics.js        — PhysicsSystem, DoublePendulum, CartPole → window.*
6. js/engine/metrics.js        — Metrics → window.Metrics
7. js/controllers/pid.js       — PIDController → window.PIDController
8. js/controllers/lqr.js       — LQR, LQRController → window.LQR, window.LQRController
9. js/projects/registry.js     — PROJECTS, PROJECT_CATEGORIES, ProjectRegistry → window.*
10. js/projects/double-pendulum.js  — self-registers via ProjectRegistry.register()
11. js/projects/cart-pole.js        — self-registers via ProjectRegistry.register()
12. js/projects/robot-arm.js        — self-registers via ProjectRegistry.register()
13. js/projects/fusion-demo.js      — self-registers via ProjectRegistry.register()
14. js/projects/grid-shift.js       — self-registers via ProjectRegistry.register()
15. js/router.js               — Router → window.Router
13. js/app.js                  — DOMContentLoaded → creates router, defines pages, starts
```

**Dependencies flow downward.** A project module (10, 11) can use anything loaded before it
(RK4, physics, metrics, PID, LQR, numeric.js, Chart.js). The router and app load last.

**Adding a new script:** Insert it in index.html between the controllers and js/router.js.
The project's IIFE calls `ProjectRegistry.register(id, render, cleanup)` which must happen
after registry.js loads.

---

## 4. GLOBAL OBJECTS

Every module exports to `window`. There are no ES modules, no imports, no bundler.

| Global                | Source              | Type       | Description                                     |
|-----------------------|---------------------|------------|-------------------------------------------------|
| `numeric`             | CDN (numeric.js)    | Object     | Matrix ops: `.dot`, `.inv`, `.eig`, `.transpose`, `.sub`, `.add`, `.mul`, `.identity`, `.norm2`, `.svd` |
| `THREE`               | CDN (Three.js)      | Object     | 3D rendering (available but unused by current projects) |
| `Chart`               | CDN (Chart.js)      | Class      | `new Chart(canvas, config)` for real-time plots |
| `RK4`                 | engine/rk4.js       | Object     | `.step(f,t,y,h)`, `.integrate(f,t,y,dt,substeps)` |
| `PhysicsSystem`       | engine/physics.js   | Class      | Base class for all simulations                  |
| `DoublePendulum`      | engine/physics.js   | Class      | Extends PhysicsSystem                           |
| `CartPole`            | engine/physics.js   | Class      | Extends PhysicsSystem                           |
| `Metrics`             | engine/metrics.js   | Object     | `.compute(t, y, ref, band)`, `.rms(arr)`, `.html(m)` |
| `PIDController`       | controllers/pid.js  | Class      | `.compute(sp, pv, dt)`, `.reset()`              |
| `LQR`                 | controllers/lqr.js  | Object     | `.care(A,B,Q,R)`, `.gain(A,B,Q,R)`, `.apply(K,x,ref)` |
| `LQRController`       | controllers/lqr.js  | Class      | `.design(eq)`, `.compute(x)`                    |
| `PROJECTS`            | projects/registry.js| Array      | All project config objects                      |
| `PROJECT_CATEGORIES`  | projects/registry.js| Object     | Category metadata (label, CSS color)            |
| `ProjectRegistry`     | projects/registry.js| Object     | `.get(id)`, `.register(id, render, cleanup)`    |
| `Router`              | router.js           | Class      | Hash-based SPA router                           |
| `window._router`      | app.js              | Router     | The active router instance (for cleanup registration) |

---

## 5. ROUTING

### Hash-based SPA routing (router.js)

Routes are defined in `app.js` via `router.on(pattern, handler)`.

| Hash                    | Pattern             | Handler          | Params     |
|-------------------------|---------------------|------------------|------------|
| `#/`                    | `/`                 | renderHome       | —          |
| `#/projects`            | `/projects`         | renderProjects   | —          |
| `#/projects/double-pendulum` | `/projects/:id` | renderDetail  | `{id: 'double-pendulum'}` |
| `#/about`               | `/about`            | renderAbout      | —          |
| `#/cv`                  | `/cv`               | renderCV         | —          |
| `#/contact`             | `/contact`          | renderContact    | —          |

### Route lifecycle

1. User clicks a link (or hash changes).
2. `Router.resolve()` fires.
3. If `this.cleanup` is set (from the previous page), it's called first.
   - This is where project modules cancel `requestAnimationFrame`, destroy Chart.js instances, etc.
4. The matched handler receives a fresh `<div class="page-enter">` inside `#app`.
5. The handler builds the page DOM and starts any animation loops.

### Navigation highlighting

`Router._nav(hash)` updates `.active` on `.nav-links a` elements. A link is active if:
- The hash exactly matches its `href`, OR
- The hash starts with `href + '/'` (so `/projects` stays active on `/projects/double-pendulum`).

---

## 6. THEME SYSTEM

### CSS variables

Two complete sets of CSS custom properties defined on `:root` (light) and `[data-theme="dark"]`.

The theme attribute lives on `<html>`: `document.documentElement.setAttribute('data-theme', 'dark')`.

**Key variable groups:**
- `--bg`, `--bg-subtle`, `--bg-muted`, `--bg-card` — background hierarchy
- `--text`, `--text-2`, `--text-3` — text hierarchy (primary, secondary, muted)
- `--border`, `--border-2` — border hierarchy
- `--accent`, `--accent-2`, `--accent-soft`, `--accent-text` — brand color (indigo)
- `--green`, `--red`, `--orange` + `-soft` variants — semantic colors for metrics
- `--cat-control`, `--cat-software`, `--cat-math`, `--cat-data` — category badge colors
- `--shadow`, `--shadow-lg` — elevation shadows

### Color scheme: warm neutral + indigo

Light mode: `#fcfcfa` base (warm white), `#1c1917` text (warm black), `#4338ca` accent (indigo-700).
Dark mode: `#0f0f0f` base (near black), `#e2e8f0` text (cool white), `#818cf8` accent (indigo-400).

### Theme toggle

`#theme-toggle` button in the nav. Persists to `localStorage.theme`.
Falls back to `prefers-color-scheme: dark` media query on first visit.

### Theme in Canvas rendering

Project modules that draw on `<canvas>` must check the theme dynamically:
```js
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
```
This is called every frame inside the draw function. Canvas does not respond to CSS variables.

---

## 7. PROJECT SYSTEM

### Registry (projects/registry.js)

`PROJECTS` is an array of project config objects:

```js
{
  id: 'double-pendulum',       // URL slug, used in hash routing
  title: 'Double Pendulum Control',
  subtitle: 'From chaos to stability',
  category: 'control',          // must match a key in PROJECT_CATEGORIES
  status: 'live',               // 'live' | 'wip' | 'planned'
  tags: ['Lagrangian', 'RK4', 'LQR', 'PID'],
  desc: 'Full description...',  // shown on the project detail page
  short: 'One-liner...',        // shown on project cards
  render: null,                 // set by ProjectRegistry.register()
  cleanup: null,                // set by ProjectRegistry.register()
}
```

`PROJECT_CATEGORIES` maps category keys to `{label, color}`.

### Project module pattern (e.g. double-pendulum.js)

Every project module is an IIFE that:
1. Declares module-scoped state (raf, sys, ctrl, charts, etc.)
2. Defines `render(container)` — builds DOM inside `container`, starts animation loop
3. Defines `cleanup()` — cancels raf, destroys charts, nulls references
4. Calls `ProjectRegistry.register(id, render, cleanup)` at the end

```js
(function(){
  let raf = null, sys = null, ctrl = null, ch1 = null;

  function render(container) {
    // Build UI (innerHTML), create physics, wire events, start loop
    function loop() { /* step, draw, update charts */ raf = requestAnimationFrame(loop); }
    loop();
  }

  function cleanup() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (ch1) { ch1.destroy(); ch1 = null; }
    sys = null; ctrl = null;
  }

  ProjectRegistry.register('my-project', render, cleanup);
})();
```

### How project detail pages work (app.js → renderDetail)

1. `renderDetail(container, {id})` looks up the project via `ProjectRegistry.get(id)`.
2. If `project.render` exists, it creates a wrapper with back link, title, description,
   and a `<div id="pm">` mount point, then calls `project.render(mountDiv)`.
3. If `project.cleanup` exists, it registers it with `window._router.setCleanup(...)`.
4. If `project.render` is null (planned project), a placeholder is shown.

### Adding a new project (step by step)

1. Add config object to `PROJECTS` array in `registry.js`.
2. Create `js/projects/your-id.js` following the IIFE pattern above.
3. Add `<script src="js/projects/your-id.js"></script>` to `index.html`
   between the last project script and `js/router.js`.
4. The project card, filter, and detail page are automatic.

---

## 8. PHYSICS ENGINE

### RK4 Integrator (engine/rk4.js)

Stateless utility. Two main methods:

- `RK4.step(f, t, y, h)` — single RK4 step. `f(t, y)` returns derivative array.
- `RK4.integrate(f, t, y, dt, substeps)` — `substeps` RK4 steps of size `dt/substeps`.

Default substeps = 10. Projects typically use 20 for stiff systems (double pendulum upright).

### PhysicsSystem base class (engine/physics.js)

All simulation scenarios extend this class.

**Properties:**
- `g` — gravity (9.81)
- `dt` — frame timestep (1/60)
- `substeps` — RK4 substeps per frame (20)
- `time` — current simulation time
- `state` — state vector (array of numbers)
- `tau` — control input vector (set each step)
- `friction` — base damping coefficient
- `hist` — history object: `{t[], s[], u[], e[], max}`

**Methods to override in subclasses:**
- `deriv(t, state)` → derivative vector (equations of motion)
- `getPos(state)` → array of `{x, y}` world positions
- `getEnergy(state)` → `{T, V, E}` (kinetic, potential, total)
- `linearize(equilibrium)` → `{A, B}` state-space matrices
- `get nu()` → number of control inputs
- `clamp()` → enforce joint/track limits

**step(u)** is the main simulation method:
1. Sets `this.tau = u` (control inputs)
2. Calls `RK4.integrate` with `this.deriv`
3. Calls `this.clamp()`
4. Advances `this.time`
5. Records state/torque/energy to `this.hist`
6. Trims history to `hist.max` entries

### DoublePendulum

**State vector:** `[θ₁, ω₁, θ₂, ω₂]`
- θ₁, θ₂ = angles measured from **downward vertical** (0 = hanging down, π = upright)
- ω₁, ω₂ = angular velocities

**Physics:**
- Lagrangian mechanics with distributed mass (uniform rods, not point masses)
- Moment of inertia about pivot: I = (1/3)mL²
- Mass matrix is 2×2 (coupled), solved analytically each timestep
- Viscous damping: τ_friction = -b·ω per joint
- Single control input: torque at joint 1

**Targets:**
- Upright: `[π, 0, π, 0]` — both links pointing up (unstable equilibrium)
- Downward: `[0, 0, 0, 0]` — both links hanging (stable equilibrium)

**linearize(eq):** Computes A (4×4) and B (4×1) around any equilibrium `[θ₁_eq, 0, θ₂_eq, 0]`.
Uses `cos(θ_eq)` for gravity linearization, so it correctly handles both upright and downward.
At upright (π, π): `cos(π) = -1`, so gravity terms flip sign → A has positive eigenvalues → unstable.

**getPos(state):** Returns 3 positions: `[pivot, joint2, end-effector]`.
- pivot is always at (0, 0)
- joint2 = (L1·sin(θ₁), -L1·cos(θ₁))
- end-effector = joint2 + (L2·sin(θ₂), -L2·cos(θ₂))

### CartPole

**State vector:** `[x, ẋ, θ, ω]`
- x = cart position on track
- θ = pole angle from **vertical upward** (θ=0 is balanced, θ>0 tilts right)

**Physics:**
- Cart mass M, pole mass m, pole half-length L
- Cart friction b, pole pivot friction bp
- Track limits: xMin, xMax (elastic clamp)
- Single control input: horizontal force on cart

**linearize():** Always linearizes around upright `[0,0,0,0]`.

---

## 9. CONTROLLERS

### PIDController (controllers/pid.js)

**Constructor:** `new PIDController({kp, ki, kd, min, max})`

**compute(setpoint, processVariable, dt):**
1. Proportional: `kp * error`
2. Integral: accumulated `error * dt`, clamped to [-100, 100]
3. Derivative: `kd * (error - prevError) / dt`
4. Output clamped to `[min, max]`
5. Anti-windup: if output saturates, undo the integral accumulation for that step

**Usage in projects:**
```js
const pid = new PIDController({kp: 20, ki: 0.5, kd: 6, min: -50, max: 50});
const torque = pid.compute(targetAngle, currentAngle, dt);
system.step([torque]);
```

### LQR (controllers/lqr.js)

Two parts: the `LQR` utility object and the `LQRController` class.

**LQR.care(A, B, Q, R)** — Solves the Continuous Algebraic Riccati Equation:
  `A'P + PA - PBR⁻¹B'P + Q = 0`

Algorithm:
1. Build the 2n×2n Hamiltonian matrix `H = [A, -BR⁻¹B'; -Q, -A']`
2. Compute eigendecomposition of H using `numeric.eig(H)`
3. Select eigenvalues with negative real parts (stable subspace)
4. Extract corresponding eigenvectors, split into U1 (top n rows) and U2 (bottom n rows)
5. `P = U2 · U1⁻¹`, symmetrized as `(P + P')/2`
6. If eigenvalue method fails (not enough stable eigenvalues), falls back to iterative Kleinman method

**LQR.gain(A, B, Q, R)** → `{K, P}` where `K = R⁻¹B'P`

**LQR.apply(K, x, ref)** → control vector `u = -K(x - ref)`

**LQRController** wraps this for use with a PhysicsSystem:
```js
const ctrl = new LQRController(system, Q, R);
ctrl.design([π, 0, π, 0]);  // linearize around this equilibrium
ctrl.min = -50; ctrl.max = 50;  // torque saturation
const u = ctrl.compute(system.state);
system.step(u);
```

**Important:** The LQR is designed on the **linearized** system but applied to the **nonlinear** system.
This is standard practice and works well near the equilibrium, but can fail for large deviations.

---

## 10. PERFORMANCE METRICS (engine/metrics.js)

**Metrics.compute(t, y, ref, band=0.02)** analyzes a time-series response:

| Metric          | Symbol | Description                                                    |
|-----------------|--------|----------------------------------------------------------------|
| Settling time   | ts     | Last time the signal exits the ±band (default 2%) around ref   |
| Steady-state error | sse | Mean |error| over the last 10% of the signal                    |
| Overshoot       | os     | Peak deviation from ref, as % of initial error                 |
| Rise time       | tr     | Time from 10% to 90% of the step (first crossing)             |
| IAE             | iae    | ∫|y(t) - ref| dt over the entire signal                        |

**Metrics.rms(arr)** — root mean square of an array (used for control effort).

**Metrics.html(m)** — returns HTML string of metric boxes with color coding.

### How metrics are used in projects

**Double pendulum:**
- Primary metric is **end-effector position error** (Euclidean distance from target position)
- Also tracks θ₁ settling and θ₂ settling individually
- Target end-effector position computed via `sys.getPos(TARGETS[target])[2]`
- Updated every 30 animation frames (0.5s) during playground
- Computed once at simulation end in design walkthrough

**Cart-pole:**
- Primary metric is θ settling (angle to vertical)
- Also tracks cart position steady-state error
- Force RMS for control effort

### Color coding

Metric values receive CSS classes:
- `.good` → `var(--green)` — within acceptable range
- `.warn` → `var(--orange)` — marginal
- `.bad` → `var(--red)` — poor performance

Thresholds are set per-metric in the project code, not in metrics.js.

---

## 11. CHART.JS USAGE

Each project creates Chart.js instances for real-time plotting.

**Pattern:**
```js
const chart = new Chart(canvas, {
  type: 'line',
  data: { labels: [], datasets: [
    { label: 'θ₁', data: [], borderColor: '#6366f1', borderWidth: 1.5, pointRadius: 0, tension: .3 },
    { label: 'θ₂', data: [], borderColor: '#b45309', borderWidth: 1.5, pointRadius: 0, tension: .3 },
  ]},
  options: {
    animation: false,              // critical for real-time performance
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { font: { size: 10, family: 'Outfit' } } } },
    scales: { x: { display: false }, y: { ticks: { font: { size: 9 } } } }
  }
});
```

**Updating (every frame):**
```js
chart.data.labels = timeArray.slice(-250);
chart.data.datasets[0].data = dataArray.slice(-250);
chart.update('none');  // 'none' disables animation for this update
```

**Cleanup:** `chart.destroy()` in the project's `cleanup()` function. Failing to do this
causes memory leaks and ghost canvases on route change.

---

## 12. CANVAS RENDERING

Projects use `<canvas>` with 2D context for physics visualizations.

**Coordinate system:**
- Canvas origin is top-left.
- Physics origin (`ox, oy`) is placed mid-width, and vertically positioned based on target:
  - Upright target: `oy = H * 0.65` (pivot near bottom, pendulum reaches up)
  - Downward target: `oy = H * 0.3` (pivot near top, pendulum hangs down)
  - Cart-pole: `oy = H * 0.7` (track near bottom)
- Scale factor `sc` converts meters to pixels (typically 80-110).
- Y is inverted: `canvasY = oy - physicsY * sc`

**Draw order (back to front):**
1. Background fill
2. Grid lines
3. Target ghost (dashed lines + crosshair) at low opacity
4. End-effector trace
5. Links (thick strokes)
6. Joints (filled circles)
7. Info text overlay (top-left)

**No z-index concerns** — canvas is a single layer, draw order = visual order.

**Theme-aware colors** are looked up every frame via `isDark()`.
Do not cache the theme check — it must be live to respond to toggling.

---

## 13. EVENT HANDLING

### Slider wiring pattern

Projects use a `hook(sliderId, valueId, unit, callback)` helper:
```js
function hook(s, v, u, cb) {
  const el = container.querySelector('#' + s);
  el?.addEventListener('input', () => {
    container.querySelector('#' + v).textContent = el.value + (u || '');
    cb?.();
  });
}
hook('s-m1', 'v-m1', ' kg', rebuild);
```
- Sliders are `<input type="range">` with IDs like `s-m1`.
- Display labels are `<span>` with IDs like `v-m1`.
- The callback (e.g. `rebuild`) typically re-creates the physics system and controller.

### Controller mode switching

Pill-select buttons inside `.pill` or `#ctrl-sel`:
```js
container.querySelectorAll('#ctrl-sel button').forEach(b => {
  b.addEventListener('click', () => {
    container.querySelectorAll('#ctrl-sel button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    ctrlMode = b.dataset.m;  // 'none', 'pid', 'lqr'
    // show/hide relevant control panels
    // instantiate the selected controller
  });
});
```

### Tab switching (Playground / Design)

```js
container.querySelectorAll('.tab-btn').forEach(b => {
  b.addEventListener('click', () => {
    container.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    // toggle display of #dp-play and #dp-design
  });
});
```

### All event listeners are scoped to `container`

Project modules never use `document.querySelector` — they use `container.querySelector`
(where `container` is the mount point passed to `render()`). This ensures no leaking
between routes.

### No global event listeners

Projects do not attach `window` or `document` level listeners. This means no cleanup
of global listeners is needed, only `cancelAnimationFrame` and `chart.destroy()`.

---

## 14. DOUBLE PENDULUM — DETAILED BEHAVIOR

### Target system

The target for the double pendulum is the **end-effector position** (tip of the second link),
not just the angle of the first link. When both links are upright (θ₁=π, θ₂=π):
- End-effector is at world position (0, L1+L2) — directly above the pivot.

The control input is **torque at joint 1 only**. The LQR uses full-state feedback
(all 4 states) to achieve control of both links via the coupling in the dynamics.

### Metrics tracked

| Metric          | Signal                     | Ref   | Notes                           |
|-----------------|----------------------------|-------|---------------------------------|
| EE settling     | √((x-x_t)²+(y-y_t)²)     | 0     | Euclidean distance to target EE |
| EE steady-state | Same signal, last 10%      | 0     | Should approach 0               |
| θ₁ settling     | state[0]                   | π     | First link angle                |
| θ₂ settling     | state[2]                   | π     | Second link angle               |
| Overshoot       | EE distance signal         | 0     | % of initial EE error           |
| RMS torque      | hist.u[i][0]               | —     | Control effort                  |

### Canvas visualization

- Target ghost: dashed lines showing both links in target position + crosshair at target EE
- End-effector trace: last 400 positions of the tip of link 2
- Info overlay: time, energy, torque, and **EE error** (live distance from target)

### Initial conditions

- Upright target: `[π-0.3, 0, π+0.2, 0]` — slightly perturbed from upright
- Downward target: `[1.8, 0, 2.0, 0]` — large initial angles

### Design walkthrough steps

1. **System definition** — state vector, distributed mass, current physics params
2. **Linearization** — A and B matrices around selected target, open-loop eigenvalues
3. **Controllability** — rank of [B, AB, A²B, A³B] using SVD
4. **Weight selection** — Q₁₁ (θ₁ cost), Q₃₃ (θ₂ cost), R (effort cost) — adjustable sliders
5. **Riccati solution** — computes K vector, shows closed-loop eigenvalues
6. **Simulation** — runs nonlinear system under LQR, computes final metrics

---

## 15. CART-POLE — DETAILED BEHAVIOR

### Target

Always the **upright equilibrium**: `[x=0, ẋ=0, θ=0, ω=0]`.
- θ=0 means the pole is perfectly vertical (balanced).
- x=0 means the cart is at the center of the track.

### Metrics tracked

| Metric          | Signal       | Ref | Notes                    |
|-----------------|-------------|-----|--------------------------|
| θ settling      | state[2]    | 0   | Pole angle settling      |
| θ SSE           | state[2]    | 0   | Steady-state angle error |
| θ overshoot     | state[2]    | 0   | % overshoot              |
| θ rise time     | state[2]    | 0   | 10%→90%                  |
| Cart SSE        | state[0]    | 0   | Cart position drift      |
| RMS force       | hist.u[0]   | —   | Control effort           |

### Canvas visualization

- Horizontal track with tick marks
- Cart as a rounded rectangle with wheels
- Pole as a thick line from cart center
- Dashed vertical line at x=0 showing target vertical
- Info overlay: time, position, angle, force

---

## 16. CSS COMPONENT REFERENCE

| Class           | Purpose                                           |
|-----------------|--------------------------------------------------|
| `.card`         | Project card (clickable, hover effect)            |
| `.card.planned` | Grayed out, non-clickable card                   |
| `.card-top`     | Card preview area (120px height)                  |
| `.card-badge`   | Category label (absolute positioned in card-top)  |
| `.card-status`  | Status label (absolute positioned, top-right)     |
| `.tag`          | Small rounded label (indigo on indigo-bg)         |
| `.btn`          | Standard button (border, hover to accent)         |
| `.btn-p`        | Primary button (filled accent)                    |
| `.btn-sm`       | Small button variant                              |
| `.pill`         | Pill-shaped toggle group                          |
| `.tab-bar`      | Tab navigation bar (border-bottom)                |
| `.tab-btn`      | Tab button (border-bottom-2 when active)          |
| `.panel`        | Card-like container for controls                  |
| `.ctrl`         | Single control row (label + range slider)         |
| `.sim-wrap`     | Simulation container (canvas + header + footer)   |
| `.sim-canvas`   | Full-width canvas element                         |
| `.metrics`      | 3-column grid of metric boxes                     |
| `.metric`       | Single metric display box                         |
| `.metric-val`   | Metric value (can be `.good`, `.warn`, `.bad`)    |
| `.step`         | Walkthrough step card                             |
| `.math-block`   | Code/math display block (mono, muted bg)          |
| `.two-col`      | Two-column layout (main + 280px sidebar)          |
| `.sidebar`      | Sticky sidebar (top: 66px)                        |
| `.plots`        | Two-column plot grid                              |
| `.grid`         | Auto-fill project card grid (min 260px)           |
| `.filters`      | Filter button row                                 |
| `.fbtn`         | Filter button                                     |
| `.timeline`     | CV timeline (left border + dot markers)           |
| `.back`         | Back navigation link                              |

### Responsive breakpoints

- **860px**: `.two-col` collapses to single column, `.sidebar` becomes static
- **768px**: Reduced padding, single-column grids, smaller nav links
- **No mobile nav hamburger** — links just get smaller

---

## 17. NUMERIC.JS API (MOST-USED FUNCTIONS)

```js
numeric.dot(A, B)            // matrix multiply
numeric.transpose(A)         // transpose
numeric.inv(A)               // inverse
numeric.add(A, B)            // element-wise add
numeric.sub(A, B)            // element-wise subtract
numeric.mul(scalar, A)       // scalar multiply
numeric.identity(n)          // n×n identity matrix
numeric.eig(A)               // eigenvalue decomposition → {lambda: {x:[], y:[]}, E: {x:[][], y:[][]}}
numeric.svd(A)               // SVD → {U, S, V}
numeric.norm2(A)             // Frobenius norm
numeric.solve(A, b)          // solve Ax = b
```

Matrices are **arrays of arrays**: `[[1,2],[3,4]]`.
Vectors are **flat arrays**: `[1, 2, 3]`.
`numeric.eig` returns complex results in `.lambda.x` (real) and `.lambda.y` (imaginary).

---

## 18. KNOWN LIMITATIONS / GOTCHAS

1. **No build step.** All globals, all synchronous scripts. This is intentional.
2. **numeric.js is old (v1.2.6, 2012)** but still the best browser-side linear algebra library.
   The eigenvalue solver can fail on ill-conditioned matrices — the LQR code has a fallback.
3. **Chart.js memory leak:** If you don't call `.destroy()` before discarding a chart,
   it stays in Chart.js's internal registry. Always destroy in `cleanup()`.
4. **Canvas sizing:** Canvases have fixed `width`/`height` attributes (e.g. 680×400).
   They do NOT auto-resize with the container. For responsive behavior, you'd need to
   add a `ResizeObserver` (not currently implemented).
5. **LQR around upright equilibrium:** The double pendulum's upright equilibrium is unstable
   with positive eigenvalues. LQR *can* stabilize it, but needs aggressive Q weights.
   If the initial perturbation is too large, the linear controller fails and the pendulum
   does full rotations — this is expected nonlinear behavior, not a bug.
6. **Theme in Canvas:** CSS variables don't work in Canvas 2D. All canvas colors are
   hardcoded hex values selected per theme via `isDark()`.
7. **No server required.** Open `index.html` directly in a browser (file:// works for
   everything except CDN scripts which need HTTP). For CDN scripts, use any static server.

---

## 19. EXTENDING THE SITE

### Adding a new controller (e.g. Sliding Mode Control)

1. Create `js/controllers/smc.js`
2. Export class to `window.SMCController`
3. Add `<script src="js/controllers/smc.js"></script>` in index.html after lqr.js
4. Use in project modules: add a button to the pill selector, instantiate on click

### Adding a new physics system (e.g. spring-mass-damper)

1. Create the class in `engine/physics.js` or a new file
2. Extend `PhysicsSystem`, implement `deriv`, `getPos`, `getEnergy`, `linearize`
3. Export to `window`
4. Create a project module that uses it

### Adding 3D projects (Three.js)

Three.js is already loaded from CDN. Create a project that:
- Creates a `THREE.WebGLRenderer` inside the sim container
- Attaches it to a canvas or creates one
- Runs a render loop in `requestAnimationFrame`
- **Disposes the renderer** in `cleanup()`: `renderer.dispose(); renderer.domElement.remove()`
- Three.js scenes and geometries must also be disposed to avoid GPU memory leaks

### Deploying

Drop the entire `Portfolio/` folder on any static host:
- GitHub Pages (push to `gh-pages` branch or set the source)
- Netlify / Vercel (drag and drop)
- Any web server serving static files

No environment variables, no build commands, no dependencies to install.
