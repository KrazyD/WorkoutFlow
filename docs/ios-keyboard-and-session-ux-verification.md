# iOS keyboard and session UX verification

## Scope and status

Implemented sequentially: viewport diagnosis/correction, session swaps, protected
JSON import, superset picker, then session header. Related checks ran at each
boundary before moving on. No dependency, database schema or JSON version change,
Git commit, deployment, database reset, or production-data modification was made.
Browser verification used disposable data on localhost ports 5178 and 4178.

**Physical-iPhone acceptance remains pending. The exact cause of the reported
failure on the user's iPhone has not been established by an on-device trace,
and the issue is not claimed conclusively fixed on an iPhone.**

## 1. Keyboard diagnosis and changes

Inspection established these concrete weaknesses in the previous implementation:

- `useVisibleViewport` wrote only visual viewport height and listened only to
  `resize`. It ignored viewport panning (`offsetTop`/`scroll`) and resumption.
- `body` retained `min-height: 100vh` while the root shrank to the visual height.
  Content had internal scroll containers, but the application root remained in
  document flow. Safari focus panning was not accounted for in root positioning.
- Numeric fields used React `autoFocus`, allowing browser scrolling before the
  keyboard geometry settled. There was no scoped field/action visibility check.
- Dock hiding depended only on focus. Dismissing the iOS keyboard can leave the
  input focused, so navigation could stay hidden after height recovered.

Together these form a plausible explanation for the reported disappearing card
and residual cross-route displacement. They are code-level findings, not proof
of the precise WebKit sequence on the physical device. The distinction between
layout and visual viewports, and the roles of offset/resize/scroll, are described
in the [Visual Viewport explainer](https://github.com/WICG/visual-viewport).

Other inspected factors: session headers have no blur/filter/mask overlay;
backdrop filtering belongs to glass surfaces. The session has no route entrance
transform. The catalog's 200ms content entrance does not transform the root or
session header. Numeric editing did not call `scrollIntoView`; the long editor's
explicit scroll-to-save button still does. `viewport-fit=cover` and safe-area CSS
were already present. No additional independent keyboard compensator was found.

The correction has one geometry owner:

- A fixed root follows `VisualViewport.height` and `offsetTop`; shells inherit
  its available height. Body no longer imposes `100vh` minimum height.
- `resize`, viewport `scroll`, focus changes, `pageshow` and visibility changes
  schedule one animation-frame update. Every listener/frame/style/attribute is
  removed on cleanup. No timeout or document `scrollTo(0, 0)` recovery is used.
- Numeric fields focus with `preventScroll`. The nearest existing scroller
  reveals the card, or its form/actions if the card is too tall, or the field if
  neither fits. Users retain normal internal scrolling for longer forms.
- Dock visibility is released when visual height recovers, even while focus
  remains. Pinch zoom does not resize the application around a magnified viewport.
- Sheets use the same geometry variables; there is no second viewport hook.

Regression-first evidence: three new tests failed against the old hook (pan,
foreground/pageshow refresh, zoom) and passed after the correction. Further tests
cover repeated resize/pan/dismiss cycles, cleanup, action visibility without
window scrolling, canceled weight/repetition edits and cross-route recovery.
jsdom measurements are simulated and do not establish native keyboard behavior.

## 2. Temporary exercise swaps and persistence

The resolver retains original execution block ID/type in exercise/internal-rest
steps. The domain derives safe candidates and returns a new snapshot:

- Standalone series exchange their complete remaining sequences, including
  internal rest. Intervening blocks and explicit boundary rests retain order.
- Inside one superset, two pending members of the current round exchange
  positions in every remaining round where both exist. Other members, unequal
  set counts, and rest slots stay intact. Repeated swaps retain earlier changes.
- Performed steps remain an unchanged prefix. Series IDs, set number/total,
  weights and repetitions travel with their exercise. Progress and “Далее” are
  derived from the updated snapshot without a second execution engine.
- Cross-superset moves and targets available only in a later round are excluded.
  The sheet explains the restriction. Existing snapshots without block metadata
  remain runnable; unsafe grouping is never guessed from names or exercise IDs.

The feature awaits the existing repository's single-record update before
rendering a new current exercise. Failure retains the old state. IndexedDB reopen
restores the saved order. WorkoutTemplate and catalog records are never changed
by swaps; resolving a fresh workout starts in the original template order.
No schema migration or database reset is needed.

## 3. JSON v2 import

Names match exactly after trimming, collapsing whitespace and lowercasing.
There is no fuzzy match. Duplicate normalized incoming names, or multiple
existing matches for an incoming name, produce an explicit conflict error.

The preview shows exercise and match counts. The checkbox “Перезаписать веса и
повторы при совпадении названий упражнений” starts off for every file:

- Off: matching exercises retain their existing working values.
- On: numeric file values replace matching working values, including zero kg.
- Missing/null imported values never clear an existing value, in either mode.
- New exercises retain file values and IDs. All other exercise fields and
  template/catalog data follow the existing replacement rules.

Preview matching is advisory. The service validates again, reads current values
and performs the merge under the replacement transaction's write lock, before
clearing any table. Conflicts/write failures leave data unchanged. Active sessions
continue blocking import. Existing feedback-settings behavior and its documented
IndexedDB/localStorage cross-store atomicity limitation are unchanged. Import
options are not serialized into JSON, and its version remains 2.

## 4. Superset picker

“Добавить в суперсет” opens a searchable native-modal bottom sheet in a root
portal immediately. The title, close/cancel actions and list have accessible
names. The heading receives focus without opening the keyboard automatically;
Escape/dismissal restores focus with `preventScroll`. Native modal behavior
prevents interaction with the underlying editor/dock. The sheet scrolls within
shared viewport/safe-area geometry.

Selection adds to the requested block, closes the sheet and minimally reveals
the new series inside the existing editor scroller. Cancel changes neither draft
nor editor position. Ordinary exercise selection uses the same picker.

## 5. Header and termination

The brand and compact pill action share a safe-area top row. The complete
workout name uses the full width below, rather than competing with the button.
The header has an opaque background and explicit stacking order above scrolling
content. Touch height is at least 44 CSS px.

Inspection confirmed that the former “Выйти” opened a confirmation and cleared
the active session. Its new name is “Завершить тренировку”, with a stop icon and
unchanged confirmation/clear behavior. It is not renamed as a list-return action.
Normal browser navigation away still preserves the active session.

## Automated checks and local browser results

Final code checks:

- `pnpm check`: passed strict TypeScript, zero-warning ESLint, **310 tests in
  35 files**, and production build.
- Separate `pnpm build`: passed; manifest, service worker and 15 precache entries.
- `git diff --check`: passed.

New suites: `reorder-session.test.ts`, `exercise-import.test.ts`, and
`BottomSheet.test.tsx`. Extended suites cover viewport, App route recovery,
session UI, template picker, backup preview/service and Dexie session restoration.
Coverage includes unequal/partial/repeated superset swaps, unchanged completed
prefix/template/catalog, set counts/last/next markers, persistence-before-display,
reopen/failure rollback, normalized matching, missing values, conflict rejection,
checkbox reset, block targeting/search/cancel/save, focus and viewport cleanup.
Existing countdown, sound/vibration, PWA guards and JSON validation tests pass.

Chromium-based browser checks used **375 × 667, 390 × 844, 430 × 932** and
reduced heights 367/544/632 to exercise available content space. Repeated weight
save and repetitions cancel kept form actions within the content region and
normal document scroll at zero. Headers/docks recovered after section changes.
Search at 375 × 367 and superset insertion at 430 × 932 were checked visually;
Save/Cancel were clear of the dock. A long workout name and the termination pill
were checked at 375 × 667. JSON v2 export/preview/import succeeded with default
preservation, and a fresh session retained original template order and weight.

Production verification on port 4178 received the offline-ready notice, imported
test JSON and saved a session swap. After stopping the production server, reload
restored the reordered current/next exercises. Repetitions were then saved and
restored through another reload with the server still stopped. This establishes
local Chromium precache/session behavior, not iPhone standalone offline behavior.

## Physical iPhone acceptance still required

Use the installed PWA as well as Safari; record iOS version/device. On a copy of
current data, check all of these before considering the keyboard issue closed:

1. Repeated weight → repetitions editing, save and cancel, and system keyboard
   dismissal while focus remains. Keep input, value and required actions visible.
2. Scroll while the keyboard is open; close it and switch among Workouts, Builder
   and Settings. Check header position, dock return, no black gap or residual pan.
3. Background/foreground and lock/unlock both during input and during active rest.
   Check viewport recovery, absolute rest deadlines and no unintended transitions.
4. Safe-area top/bottom, long names, large text, portrait/landscape and short-screen
   layouts. Open/search/close the sheet in a long editor without position jumps.
5. Partial/unequal superset swapping, last/next markers, force-close/relaunch and
   resumed order; end the workout and verify a new run uses template order.
6. Files-based JSON import with the checkbox off/on and omitted working fields;
   verify conflicts leave data untouched and an active session blocks import.
7. Airplane-mode cold launch after precaching and persisted-session restoration.

If displacement persists, capture viewport `height`, `offsetTop`, `pageTop`,
`scale`, `window.innerHeight`/`scrollY`, root/scroller rects and focus before,
during and after the failure. That on-device evidence is needed to distinguish
an unreported WebKit pan/compositor regression from the corrected layout defects.

## Changed files

- [docs/architecture.md](../docs/architecture.md)
- [docs/domain-model.md](../docs/domain-model.md)
- [docs/ios-keyboard-and-session-ux-verification.md](../docs/ios-keyboard-and-session-ux-verification.md)
- [docs/product.md](../docs/product.md)
- [docs/workout-flow.md](../docs/workout-flow.md)
- [src/App.test.tsx](../src/App.test.tsx)
- [src/db/dexie-workout-data-backup-service.test.ts](../src/db/dexie-workout-data-backup-service.test.ts)
- [src/db/dexie-workout-data-backup-service.ts](../src/db/dexie-workout-data-backup-service.ts)
- [src/db/series-persistence.test.ts](../src/db/series-persistence.test.ts)
- [src/domain/resolve-workout-template.ts](../src/domain/resolve-workout-template.ts)
- [src/domain/workout-session/README.md](../src/domain/workout-session/README.md)
- [src/domain/workout-session/index.ts](../src/domain/workout-session/index.ts)
- [src/domain/workout-session/reorder-session.test.ts](../src/domain/workout-session/reorder-session.test.ts)
- [src/domain/workout-session/reorder-session.ts](../src/domain/workout-session/reorder-session.ts)
- [src/domain/workout-session/types.ts](../src/domain/workout-session/types.ts)
- [src/domain/workout-session/workout-session.ts](../src/domain/workout-session/workout-session.ts)
- [src/features/data-backup/DataBackupScreen.test.tsx](../src/features/data-backup/DataBackupScreen.test.tsx)
- [src/features/data-backup/DataBackupScreen.tsx](../src/features/data-backup/DataBackupScreen.tsx)
- [src/features/data-backup/exercise-import.test.ts](../src/features/data-backup/exercise-import.test.ts)
- [src/features/data-backup/exercise-import.ts](../src/features/data-backup/exercise-import.ts)
- [src/features/data-backup/workout-data-backup.ts](../src/features/data-backup/workout-data-backup.ts)
- [src/features/workout-session/WorkoutSessionScreen.test.tsx](../src/features/workout-session/WorkoutSessionScreen.test.tsx)
- [src/features/workout-session/WorkoutSessionScreen.tsx](../src/features/workout-session/WorkoutSessionScreen.tsx)
- [src/features/workout-templates/ExercisePickerSheet.tsx](../src/features/workout-templates/ExercisePickerSheet.tsx)
- [src/features/workout-templates/SeriesFields.tsx](../src/features/workout-templates/SeriesFields.tsx)
- [src/features/workout-templates/WorkoutTemplatesScreen.test.tsx](../src/features/workout-templates/WorkoutTemplatesScreen.test.tsx)
- [src/features/workout-templates/WorkoutTemplatesScreen.tsx](../src/features/workout-templates/WorkoutTemplatesScreen.tsx)
- [src/shared/BottomSheet.test.tsx](../src/shared/BottomSheet.test.tsx)
- [src/shared/BottomSheet.tsx](../src/shared/BottomSheet.tsx)
- [src/shared/NumericValueCard.tsx](../src/shared/NumericValueCard.tsx)
- [src/shared/README.md](../src/shared/README.md)
- [src/shared/use-visible-viewport.test.tsx](../src/shared/use-visible-viewport.test.tsx)
- [src/shared/use-visible-viewport.ts](../src/shared/use-visible-viewport.ts)
- [src/styles.css](../src/styles.css)
