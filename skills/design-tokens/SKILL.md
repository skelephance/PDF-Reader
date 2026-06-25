---
name: design-tokens
description: Enforce the Libra-Local universal design system. Use this skill whenever writing, editing, or reviewing any CSS, component styles, or layout geometry in the libra-local project — including spacing, padding, margins, gaps, border-radius, and any visual primitive. Trigger even when the user doesn't mention "tokens" but is touching component styling, toolbars, library tiles, the reader viewport, annotation blocks, or any UI layout.
---

# Libra-Local Design Tokens

Libra-Local is a premium, local-first PDF reader targeting legacy iOS chipsets. Visual consistency and predictable layout are part of what makes it feel premium, and hardcoded values are the main way that consistency rots over time. The whole point of the token system is that a single source of truth controls every edge offset, so the UI stays coherent and can be retuned globally without hunting through files.

## The core rule

Never use raw pixel integers or inline styles for layout geometry. Every padding, margin, gap, and edge offset must resolve through a `--spacing-*` token, and every corner radius through a `--radius-*` token. If you're typing a number followed by `px` or `rem` for a layout property, stop and reach for the token instead.

Inline styles are barred because they can't be governed by the token layer and they fragment the design system one component at a time. Put styles in the component's stylesheet or in `styles/`, referencing tokens.

## Token matrix

These are defined in `src/styles/tokens.css`. Use them by name; don't reintroduce their literal values.

| Token | Value | Use for |
|---|---|---|
| `--spacing-tight` | 0.5rem (8px) | Inner element margins, label buffers |
| `--spacing-element` | 0.75rem (12px) | Toolbar configurations, button gutters |
| `--spacing-card` | 1.0rem (16px) | Library thumbnails, annotation text blocks |
| `--spacing-container` | 1.5rem (24px) | Master window outer boundaries |
| `--radius-interactive` | 12px | Clickable buttons, select fields |
| `--radius-container` | 20px | Folder tiles, sliding contextual sheets |

## Examples

**Wrong** — hardcoded geometry and inline style:
```html
<div style="padding: 16px; border-radius: 20px; margin-bottom: 8px;">
```

**Right** — token-driven, in a stylesheet:
```css
.library-tile {
  padding: var(--spacing-card);
  border-radius: var(--radius-container);
  margin-bottom: var(--spacing-tight);
}
```

## When a token doesn't fit

If a layout genuinely needs a value the matrix doesn't cover, that's a signal the matrix may need a new token — raise it rather than hardcoding a one-off. Adding `--spacing-*`/`--radius-*` entries to `tokens.css` keeps the system as the single source of truth. Properties that aren't layout geometry (e.g. `line-height`, `z-index`, hairline `1px` borders) are outside this rule and can use literal values where sensible.
