# UX and workout model verification

## Implementation

Templates now contain explicit exercise series (stable ID, exercise reference,
set count, optional rest) and supersets (ordered series plus block rest).
`resolveWorkoutTemplate` expands rounds into the existing execution engine;
there is only one session transition mechanism. Every expanded set stores its
series ID, number and total. `getSetProgress` powers both the counter and final
set marker; `getNextExercise` skips rest in the active snapshot.

The editor provides set counts, rest selection and superset composition. A
floating accessible button observes Save and scrolls to it; its position uses
safe-area insets. An edited template is filtered from the visible list until
Save or Cancel without deleting it or showing a false empty state.

Latest catalog weight and current snapshot weights are saved atomically in
IndexedDB. Decimal dot/comma input, zero, unspecified weight, clearing and
Russian formatting are supported. Invalid input and write failures keep the
form open. No result history or per-set statistics are introduced.

IndexedDB remains at version 4 with unchanged tables/indexes. New properties
need no schema upgrade or cleanup. Existing data is retained; old individual
steps are independent one-set series and are never heuristically grouped.
Backup format is version 2 and rejects v1. Full validation precedes mutation;
a transaction replaces catalogs, locks active sessions and aborts on write
failure. Settings are included, active sessions are excluded. See
[domain model](domain-model.md) and [architecture](architecture.md).

## Automated checks

`pnpm check` passed: strict TypeScript, ESLint with zero warnings, 239 tests in
29 files, and a production build. A separate `pnpm build` also passed and
produced the manifest, service worker and 15 precache entries.
`git diff --check` passed.

New/extended tests cover:

- Save visibility, smooth scrolling, observer cleanup, and create/edit modes.
- Hiding only the edited template and returning it after Save/Cancel.
- Single series, equal/unequal supersets, independent repeated exercises,
  counters, final sets, next exercise, validation and serialized restoration.
- Decimal weights, changes, clearing, zero, invalid input, save errors,
  snapshot immutability, subsequent sets and a new workout's initial weight.
- IndexedDB template/session recovery, rest deadline after reopening the DB,
  preservation of weight during catalog edits, and atomic weight rollback.
- JSON v2 round-trip, nested references/IDs/counts/weights, v1 rejection,
  validation before mutation, database rollback and settings-write rollback.
- Existing rest expiry, skip/+30 seconds, sound/vibration, navigation and PWA
  suites continue passing.

## Local browser checks

Used isolated localhost test data (two exercises, a 30-second rest and a
three-round superset). Verified:

- Creation of a superset with three sets for each exercise.
- Editing a long template with several extra independent series, floating
  arrow scrolling to Save, arrow disappearing when Save is visible.
- Edited workout hidden from the list, restored after Cancel.
- Actual A1/B1/A2/B2/A3/B3 order, independent counters, both final-set markers
  and the final-exercise message.
- Setting 59,1 kg, retaining it through reload, later sets and a fresh workout.
- Automatic entry into rest, skipping, +30 seconds, absolute deadline recovery
  and workout completion.
- JSON download, validation preview and successful re-import; importing the
  same backup into the production preview restored the series and weight.
- Production deep-route loading and the PWA offline-ready notice.
- After stopping the production preview server, reloading the workout list,
  starting the imported superset and reloading its active rest still worked
  from the service worker cache and IndexedDB.

## Before publishing on iPhone

- Install from Safari to the Home Screen, finish precaching, then test airplane
  mode and cold launch. Safari and standalone storage may differ.
- Check floating-arrow positioning around safe areas, portrait/landscape,
  large text and the open keyboard; ensure Save and other controls stay usable.
- Check the decimal keyboard, comma/dot entry, changing/clearing weights and
  JSON import/export through Files in both Safari and standalone mode.
- Background/lock the phone during rest, then return and force-relaunch; verify
  deadlines, counters, weights and the exact next exercise.
- Check actual audio gesture permissions, silent mode and vibration support;
  browser automation cannot establish physical sound/vibration delivery.
- Check update consent and active-session protection on the installed PWA.

No Git commit, VPS connection or deployment was performed.
