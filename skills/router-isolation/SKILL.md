---
name: router-isolation
description: Enforce centralized navigation through the UniversalRouter in the libra-local project. Use this skill whenever adding or editing navigation, screen transitions, back buttons, view switching, modals, sliding panels/sheets, or any flow that moves the user between Library, Reader, or annotation views. Trigger even when the user says "go back", "open a panel", "switch screens", or wires up a button that changes what's on screen.
---

# Libra-Local Router Isolation

Libra-Local runs as a single-page webview app inside Tauri. Navigation state lives in one place — the centralized `UniversalRouter` state machine (`src/core/navigation/`) — so that the app's view history, transitions, and panel state are always coherent. The failure mode this prevents is the slow accretion of bespoke, localized navigation logic: a custom back button here, an ad-hoc `history.back()` there, a panel that toggles its own `display` flag. Each one seems harmless but together they create competing sources of truth, broken back behavior, and transitions that fight each other.

## The core rule

Do not write unique inline navigation events or create custom, localized back buttons. Every visual transition — opening the reader, returning to the library, sliding the annotation panel in or out — must interface directly with the `UniversalRouter` state stack.

This means components describe *intent* ("navigate to reader for this document", "pop to previous view", "open annotation panel") by dispatching to the router. They do not directly manipulate the DOM visibility of other views, call browser history APIs, or hold their own "am I open" booleans for routed surfaces.

## Why centralize

A single state stack gives you correct back/forward behavior for free, makes transitions animate consistently, and means there's exactly one place to reason about "what is the user looking at." On low-spec chipsets it also avoids redundant view work, since the router can tear down what's leaving rather than letting orphaned views linger.

## Examples

**Wrong** — localized navigation and a one-off back button:
```ts
backBtn.addEventListener('click', () => { window.history.back(); });
readerView.style.display = 'none';
libraryView.style.display = 'block';
```

**Right** — dispatch intent to the router:
```ts
import { router } from '@/core/navigation';

backBtn.addEventListener('click', () => router.pop());
// open the reader:
router.navigate({ view: 'reader', docHash });
// slide the annotation panel:
router.navigate({ view: 'reader', docHash, panel: 'annotate' });
```

## Sliding panels and sheets count as navigation

The annotation panel and contextual sheets are routed surfaces, not local widgets. Open and close them through the router so their state participates in the same back stack — tapping back should close the panel before leaving the reader, and the router is what makes that ordering correct.
