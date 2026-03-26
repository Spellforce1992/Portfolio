---
name: design-check
description: Review a project or page for visual consistency with the portfolio design system. Use after building or modifying UI.
allowed-tools: Read, Glob, Grep
---

Review the current portfolio code for design system consistency. Check `css/main.css` for the canonical design tokens and classes, then audit the code specified by `$ARGUMENTS` (or the whole project if no argument given).

## Check these areas:

### 1. CSS variable usage
- Colors must use `var(--text)`, `var(--text-2)`, `var(--text-3)`, `var(--accent)`, etc. — never hardcoded hex values
- Backgrounds: `var(--bg)`, `var(--bg-card)`, `var(--bg-subtle)`, `var(--bg-muted)`
- Borders: `var(--border)`, `var(--border-2)`
- Shadows: `var(--shadow)`, `var(--shadow-lg)`
- Border radius: `var(--r)` (8px) or `var(--rl)` (12px)
- Fonts: `var(--font)` for body, `var(--mono)` for code/numbers

### 2. Component classes
- Cards should use `.card`, `.card-top`, `.card-body`, `.card-badge`
- Simulation wrappers: `.sim-wrap`, `.sim-bar`, `.sim-canvas`, `.sim-foot`
- Controls: `.panel`, `.ctrl`, `.ctrl-row`
- Buttons: `.btn`, `.btn-p`, `.btn-sm`
- Metrics: `.metrics`, `.metric`, `.metric-label`, `.metric-val`
- Layout: `.two-col`, `.sidebar`, `.plots`, `.plot-box`
- Tabs: `.tab-bar`, `.tab-btn`
- Math blocks: `.math-block`

### 3. Dark mode
- Verify all custom styles work with `[data-theme="dark"]`
- Canvas drawing should read CSS variables or use theme-aware colors
- No white/black hardcoded where theme colors should be used

### 4. Responsive
- Check for `@media(max-width:860px)` and `@media(max-width:768px)` breakpoints
- Two-column layouts must collapse on mobile
- Font sizes should use `clamp()` for headings

### 5. Typography
- `h1`: `clamp(26px,4vw,38px)`, weight 700
- `h2`: `clamp(19px,2.5vw,23px)`, weight 600
- `h3`: 15px, weight 600
- Body text: default, color `var(--text-2)`
- Small text/labels: 10-12px, color `var(--text-3)`

## Output

Report issues grouped by severity (breaking > inconsistent > minor). Include the file and line where each issue occurs. Suggest specific fixes.
