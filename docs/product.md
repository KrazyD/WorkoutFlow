# Product

## Purpose

Workout Flow helps a single user conduct a workout from a sequence prepared in
advance. The application keeps attention on the current action, makes rest time
visible, and previews what comes next.

## MVP capabilities

The product will allow a user to:

1. Maintain a personal exercise catalog.
2. Maintain reusable rest presets.
3. Build a workout template from ordered exercise and rest steps.
4. Start a workout from a template.
5. Mark an exercise as complete.
6. Follow an automatic rest countdown, skip it, or add 30 seconds.
7. See the next step during an active workout.
8. Finish after all steps are complete.

## Implementation status

The catalogs, workout template editor, and timed active-workout flow are
implemented. An unfinished workout, including an active rest deadline, is
restored from local storage.

The workout list includes local sound and vibration preferences plus preview
controls. These best-effort alerts apply only to natural rest expiry; browser
support and background delivery are not guaranteed.

The data screen can export exercises, rest presets, workout templates, and
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
track weight, repetitions, workout history, or progression.

The application interface is Russian. Code, identifiers, and repository
documentation are English.
