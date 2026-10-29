# Shared

Reusable UI components and technical utilities without feature-specific rules.

Production code must create local entity identifiers through `id/createId.ts`
instead of calling Web Crypto UUID APIs directly.


`CatalogPageLayout` provides the content-only scroll area, stationary header,
segmented Builder catalogs, accessible glass dock and contextual plus action.
`NumericValueCard` shares weight/repetitions display and validated editing.
`useVisibleViewport` adjusts the root height to iOS visual-viewport resize events,
including keyboard changes; floating controls hide only for keyboard fields.

`CatalogNavigationHost` keeps the dock mounted across catalog routes, outside
route content, so active-label transitions continue during navigation. Standalone
`CatalogPageLayout` consumers retain their own dock. Session and unknown routes
have no hosted dock. Keyboard-field focus hides both hosted and standalone docks.
Catalog content uses a 200 ms opacity/6 px entrance animation without keyed
remounts, delayed navigation, outgoing interactive copies, or view snapshots.
The existing reduced-motion rule disables the entrance and dock transitions.
