# Shared

Reusable UI components and technical utilities without feature-specific rules.

Production code must create local entity identifiers through `id/createId.ts`
instead of calling Web Crypto UUID APIs directly.


`CatalogPageLayout` provides the content-only scroll area, stationary header,
segmented Builder catalogs, accessible glass dock and contextual plus action.
`NumericValueCard` shares weight/repetitions display and validated editing.
`useVisibleViewport` is the single owner of root/overlay geometry. A fixed root
follows VisualViewport height and offset on resize/scroll, with foreground and
pageshow resynchronization. Only the nearest content scroller reveals focused
fields and numeric form actions. Pinch zoom is not treated as a keyboard.
Floating controls return when viewport height recovers, even if input focus
remains after keyboard dismissal. No document scroll reset or timeout is used.
`BottomSheet` uses a native modal dialog in a root portal, with the same viewport
variables, an internal scroller, accessible heading, Escape dismissal and focus
restoration with `preventScroll`.

`CatalogNavigationHost` keeps the dock mounted across catalog routes, outside
route content, so active-label transitions continue during navigation. Standalone
`CatalogPageLayout` consumers retain their own dock. Session and unknown routes
have no hosted dock. An open keyboard hides both hosted and standalone docks.
Catalog content uses a 200 ms opacity/6 px entrance animation without keyed
remounts, delayed navigation, outgoing interactive copies, or view snapshots.
The existing reduced-motion rule disables the entrance and dock transitions.
