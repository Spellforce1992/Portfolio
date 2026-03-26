# Control Systems Portfolio — Joshua Nierop

An interactive portfolio website showcasing real-time physics simulations with adjustable control algorithms. Each project runs full nonlinear dynamics in the browser with functional PID and LQR controllers — not animations, but working simulation tools.

## Live Projects

### Double Pendulum
Two-link pendulum with Lagrangian mechanics (distributed mass, uniform rods). Features:
- Adjustable masses, lengths, and damping
- Controller selection: None / PID / LQR
- Real-time gain tuning with immediate visual feedback
- Phase portrait overlays (4 projections)
- Performance metrics: settling time, overshoot, steady-state error, RMS torque
- 6-step LQR design walkthrough (linearization → controllability → Riccati → closed-loop simulation)

### Cart-Pole (Inverted Pendulum)
Cart on a track with a hinged pole. Swing-up and balance with:
- Adjustable cart/pole mass, pole length, initial angle
- PID and LQR control with real-time tuning
- Phase portraits (3 projections)
- Design walkthrough with editable Q/R matrices

## Planned Projects

- **Robot Arm** — 3-DOF kinematics with FK/IK and trajectory tracking (Three.js)
- **Fusion Demo** — MIMO isotope ratio control
- **Optimization Visualizer** — Gradient descent on 3D loss surfaces
- **Pathfinding** — A* vs Dijkstra vs BFS visualization

## Tech Stack

- **Vanilla JavaScript** (ES6+) — no frameworks, no build step
- **numeric.js** — linear algebra, eigenvalue decomposition, Riccati solver
- **Chart.js** — real-time line charts for state/energy/control plots
- **Three.js** — loaded for planned 3D projects
- **Google Fonts** — Outfit (UI), JetBrains Mono (code/math)

No npm dependencies. Serve with any static file server.

## Getting Started

```bash
# Any static server works
python -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000` in a modern browser.

## File Structure

```
├── index.html                  SPA entry point
├── css/
│   └── main.css                Design system (light + dark theme)
├── js/
│   ├── app.js                  Page renderers (Home, Projects, About, CV, Contact)
│   ├── router.js               Hash-based SPA router
│   ├── engine/
│   │   ├── rk4.js              4th-order Runge-Kutta integrator
│   │   ├── physics.js          Base PhysicsSystem + DoublePendulum + CartPole
│   │   ├── metrics.js          Performance metrics (settling, overshoot, etc.)
│   │   ├── vectorfield.js      Phase portrait vector field renderer
│   │   └── matrixui.js         Interactive matrix table UI
│   ├── controllers/
│   │   ├── pid.js              PID controller with anti-windup
│   │   └── lqr.js              LQR with algebraic Riccati equation solver
│   └── projects/
│       ├── registry.js         Project metadata and registry
│       ├── double-pendulum.js  Double pendulum simulation
│       └── cart-pole.js        Inverted pendulum on cart
```

## Architecture

- **Hash-based SPA router** with cleanup callbacks for resource management on navigation
- **RK4 integrator** with configurable substeps (default 10, projects use 20 for stiff systems)
- **PhysicsSystem base class** — state vector management, history recording, abstract `deriv()`/`linearize()`
- **LQR solver** — builds Hamiltonian matrix, eigendecomposition for stable subspace, fallback to iterative Kleinman method
- **Metrics engine** — computes settling time, overshoot, rise time, SSE, and IAE with color-coded display
- **Design walkthroughs** — step-by-step LQR design: system definition → linearization → controllability → weight selection → Riccati solution → nonlinear simulation
