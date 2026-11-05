# Session order editor

The session-only order editor uses logical execution ranges. A standalone series
contains one series ID; a superset contains multiple series IDs with round-based
alternation. Future ranges move together with their sets and internal rest steps.
No template, catalog, export format, database schema or settings change is needed.

The active block is always pinned. Every step up to and including the current
index remains unchanged. Inside a superset, only pending exercise slots are sorted
by set number and requested member rank. This works for unequal counts and partial
rounds. The optional execution `block.seriesOrder` property preserves that rank
across subsequent edits and reloads. Set metadata, working weight and repetitions
remain attached to their original exercise step.

Explicit rests without a block retain their boundary ordinal between ranges:
`A, pause X, B, pause Y, C` becomes `A, pause X, C, pause Y, B`. Internal pauses
travel with their block. Leading/trailing explicit rests remain explicit. No rest
is added, removed or resized, including when moving a block to the end. An active
rest keeps its absolute deadline and origin; countdown and feedback continue
while the editor is open.

The full-height native modal dialog reuses viewport geometry, focus restoration
and safe-area handling from BottomSheet. Only the content list scrolls; Apply and
Cancel stay visible. Block handles use a 24 px move-vertical SVG with a 2.5 px
stroke; member handles use a 22 px grip-vertical SVG. Both use Pointer Events with
`touch-action: none` and a 5 CSS pixel vertical movement threshold for touch, pen
and mouse. There is no activation timer: a stationary hold or tap never starts a
drag. Row bodies retain normal vertical scrolling. Capture belongs to the stable
content scroller so reordering keyed rows does not interrupt the gesture in Safari.
Release, pointer cancellation, lost capture, Escape, blur, resize, page hiding and
backgrounding clear the gesture and release capture; unmount also cancels animations.
A single requestAnimationFrame loop updates the active row's transform, edge
scrolling and same-group target selection. React renders only on activation,
reordering and release, not on every pointer move. A layout effect compensates
the active row's position after reordering and animates displaced siblings using
the native Web Animations API. Release eases the active row into its slot. These
180 ms animations are omitted for prefers-reduced-motion; direct finger tracking
remains immediate. Only the handles are visible, with 44 × 44 CSS pixel targets
and lime accents; locked handles are disabled and dimmed. Focused handles accept ArrowUp
and ArrowDown through the same move callback, keep focus and scroll into view.
Screen-reader instructions and key shortcuts describe this keyboard alternative.
Members cannot be dragged across supersets, and partially performed blocks cannot
be moved as a whole. Lock text explains why. No new dependency was added.

The workout screen opens the editor with a 22 px inline arrow-left-right SVG,
using a 2.5 px stroke and the existing lime accent. The button keeps its 44 px
minimum height and existing glass styling.

Draft edits never write storage. Apply validates the plan against the latest live
session, then the existing repository commits one complete IndexedDB record.
A write failure leaves the draft open for retry and the saved session unchanged.
A timer transition that makes a plan unsafe requires closing and reopening the
editor. Reload reads the saved order; a fresh workout resolves its original
unchanged template. Old sessions lacking block metadata remain executable, with
an explanation that their order cannot be safely edited.

## Automated coverage

Domain tests cover future superset permutations, standalone/superset movement,
unequal member counts, current and future member permutations, repeated edits,
completed/current-step protection, stale/invalid plans, rest boundary placement,
active rest deadlines, all set metadata and working values, next-exercise and
last-set markers, template immutability and completing every set exactly once.
An unchanged plan also preserves older partially reordered execution snapshots.

UI tests cover distinct icons, draft cancellation, repeated edits, locked/busy
controls, immediate 5 px activation, stationary holds/taps, continuous finger
tracking across reordering, standalone mouse dragging, nested member isolation,
normal row touch scrolling, pointer capture/release, other-pointer rejection,
gesture interruption and restart, edge scrolling in both directions, native
animations and reduced motion, keyboard group boundaries, cleanup,
commit-before-render, write retry and rest expiry during editing.
Repository tests reopen IndexedDB after member and whole-block changes, verify
atomic write failure behavior and check unchanged templates/catalogs.

## Browser verification

Tested the real application at 375 × 812, 390 × 844 and 430 × 932 CSS pixels using
an isolated local origin and a disposable five-block fixture. No horizontal
content overflow was found. Header/footer remain visible while the list scrolls.
Verified continuous mouse dragging of a future superset, a standalone series and
a superset member, ordinary row scrolling, focused-handle keyboard moves, Cancel
discarding draft moves, Apply closing the editor and saved block/member order
surviving reload. All handles measured 44 × 44 CSS pixels; block SVGs measured
24 × 24 with a 2.5 px stroke and member SVGs measured 22 × 22. The current chest
press set remained active with 40 kg, 12 repetitions and 24 total working sets.
No console warnings or errors appeared during these checks. Handles compute
`touch-action: none`, cards compute `auto`, and the scroller computes `pan-y`.
Synthetic touch tests cover threshold activation, frame-by-frame positioning,
both edge-scroll directions, interruptions, capture and reduced motion.

## Physical iPhone acceptance

Browser viewport checks and synthetic Pointer Event tests do not replace a real
iPhone PWA check. Touch either handle and immediately move vertically in one
continuous gesture: the row must follow without a preliminary hold, text selection
or scroll conflict. Verify that taps do not move rows, ordinary row touches scroll,
both edge directions scroll long
lists; release, interruption and app backgrounding finish the gesture cleanly.
Check safe areas in portrait/landscape, VoiceOver handle controls, lock/unlock,
PWA reload, rest expiry during editing, and once-only sound/vibration after
reordering. In the main scenario, move the future leg superset to the end while
Chest Press + pulldown continues, then complete the remaining workout.
