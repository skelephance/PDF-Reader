---
name: reading-themes
description: Implement reading themes (night/sepia/etc.) in the libra-local PDF reader. Use this skill whenever working on theme switching, dark/night mode, color inversion, contrast or display filters over rendered PDF pages. Trigger whenever the user mentions reading modes, night mode, dark mode, sepia, eye strain, or changing how pages look, even if performance or battery isn't mentioned.
---

# Libra-Local Reading Themes

Reading themes (night, sepia, high-contrast, etc.) change how rendered PDF pages look. The naive implementation — re-rasterizing every page with adjusted colors — would trigger heavy redraw work on theme switch, drain battery, and stutter on legacy chipsets. Libra-Local instead applies themes as GPU-accelerated CSS filter layers over the already-rendered canvas, so switching themes costs essentially nothing: no re-render, just a compositor pass.

## The core rule

Implement reading filters as GPU-accelerated CSS layers applied to the page canvas via a `data-theme` attribute on the viewport frame. Do not re-render or re-rasterize pages to change their appearance, and do not manipulate pixel data in JavaScript — both defeat the entire purpose.

The canonical night theme inverts and rotates hue so text flips to light-on-dark while preserving color relationships:

```css
.pdf-viewport-frame[data-theme='night'] .pdf-page-canvas-render {
  filter: invert(1) hue-rotate(180deg);
}
```

## How to add a theme

Switch the theme by setting `data-theme` on `.pdf-viewport-frame` and defining a matching CSS rule that applies a `filter` to `.pdf-page-canvas-render`. The render pipeline (see [[pdfjs-reader-engine]]) is untouched — it keeps producing the same canvas, and the GPU recolors it on composite.

```css
.pdf-viewport-frame[data-theme='sepia'] .pdf-page-canvas-render {
  filter: sepia(0.5) brightness(0.95) contrast(0.95);
}
```

```ts
// switching themes is a single attribute write — no redraw
viewportFrame.dataset.theme = 'night';
```

## Why GPU filters

`filter` on a composited layer runs on the GPU and doesn't re-run PDF.js rasterization, so theme switches are instant and cheap on battery — exactly what's needed on hand-me-down hardware. Keep filter chains short; long chains add compositor cost. If a theme can't be expressed as a CSS `filter`, prefer adjusting it within that model rather than falling back to per-pixel JS, which would reintroduce the heavy work this approach exists to avoid.

## Token compliance

Any chrome around the viewport that changes with the theme (panels, toolbars) still follows the design system — use tokens for geometry (see [[design-tokens]]). Themes govern color/filter, not layout.
