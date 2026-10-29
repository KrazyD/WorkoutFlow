# Product

## Purpose

Workout Flow helps a single user conduct a workout from a sequence prepared in
advance. The application keeps attention on the current action, makes rest time
visible, and previews what comes next.

## MVP capabilities

The product will allow a user to:

1. Maintain a personal exercise catalog.
2. Maintain reusable rest presets.
3. Build a workout template from exercise series, supersets and rest blocks.
4. Start a workout from a template.
5. Mark an exercise as complete.
6. Follow an automatic rest countdown, skip it, or add 30 seconds.
7. See the current set, last-set marker and next exercise during a workout.
8. Finish after all steps are complete.

## Implementation status

The catalogs, workout template editor, and timed active-workout flow are
implemented. An unfinished workout, including an active rest deadline, is
restored from local storage.

Settings includes local sound and vibration preferences plus preview
controls. These best-effort alerts apply only to natural rest expiry; browser
support and background delivery are not guaranteed.

Settings can export exercises, rest presets, workout templates, and
feedback preferences to one JSON backup and restore them later. Restore is an
explicit full replacement: the user reviews entity counts and confirms before
any persisted workout data changes. An unfinished active workout blocks the
restore and is never included in a backup.

## Product principles

- Mobile-first: the primary use happens on a phone during a workout.
- Focused: the active step and its completion action dominate the session UI.
- Predictable: a workout follows the exact saved order.
- Local-first: MVP data belongs to one user on one device.
- Reusable: exercises and rest presets can appear in multiple templates.

## MVP boundaries

MVP has no backend, registration, accounts, or synchronization. It does not
track per-set results, completed repetitions, workout history, or progression.
It stores only the latest working weight and optional repetition count for each
exercise, plus their active-session values. Decimal kilograms and positive integer
repetitions can be edited and cleared during a workout.

The application interface is Russian. Code, identifiers, and repository
documentation are English.

## PWA support

The app can be installed and used offline after its first successful production
precache. Updates require confirmation and are deferred while a persisted
workout is unfinished. Local data and JSON backup remain the source of truth.
See [PWA](pwa.md) for iPhone installation, storage and background-timer limits.

## Editor behavior

The edited workout is temporarily hidden from the simultaneously visible list,
without deleting its record. Save or Cancel returns it to the list. A floating,
accessible down arrow appears while Save is offscreen and scrolls smoothly to
it. Its position includes iPhone safe-area insets.


## Mobile navigation

The Dark Glass interface has three bottom destinations: Workouts, Builder and
Settings. Builder groups exercises and rest presets in a segmented control.
Only the active bottom item shows a label; inactive items retain accessible icon
names. A contextual floating plus creates the current catalog entity. Session
screens have their own compact layout without the dock or plus button.
Working-set progress excludes rest, and the existing deadline countdown has a
circular SVG visualization. See [workout flow](workout-flow.md) for UI details.
