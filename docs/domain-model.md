# Domain model

## Exercise

A user-defined activity.

- `id`: stable unique identifier.
- `name`: non-empty display name.
- `description`: optional explanatory text.

## RestPreset

A reusable rest definition.

- `id`: stable unique identifier.
- `name`: non-empty display name.
- `durationSeconds`: positive whole number of seconds.

Rest presets accept durations from 5 through 3,600 seconds. Persistence stores
only `durationSeconds`; minutes and seconds are UI input fields rather than
additional domain properties.

## WorkoutTemplate

A reusable workout plan.

- `id`: stable unique identifier.
- `name`: non-empty display name.
- `steps`: ordered list of `WorkoutStep` values.

A persisted template must contain at least one step before it can be saved.
The template editor supports creating, reordering, replacing, and removing
steps. Starting a workout from a template is outside the current UI scope.

## WorkoutStep

A persisted step has its own stable `id` and is a discriminated union with two
variants:

- `exercise`: stores `exerciseId`, referencing an `Exercise` by identifier.
- `rest`: stores `restPresetId`, referencing a `RestPreset` by identifier.

Order is represented by position in `WorkoutTemplate.steps`, not by a mutable
order field. Names, descriptions, and durations are not copied into persisted
steps. If a referenced catalog record is later deleted, the editor displays a
missing-record placeholder and keeps the step removable or replaceable; catalog
deletion does not cascade into templates.

## ActiveWorkout

The state of one running workout.

- `templateSnapshot`: immutable workout data required to finish the session.
- `currentStepIndex`: zero-based position of the active step.
- `startedAt`: explicit start timestamp.
- `status`: `active` or `completed`.
- `restEndsAt`: end timestamp when the active step is rest; absent otherwise.

The snapshot prevents later catalog or template edits from changing an active
session. Unlike the persisted `WorkoutTemplate`, it contains resolved exercise
and rest details instead of live catalog references.

## Identity and time

Identifiers are opaque strings generated outside pure domain operations.
Timestamps use a single documented representation (milliseconds since Unix
epoch is the intended default). Current time is supplied by the caller to every
domain operation that needs it.

## Invariants

- The current step index addresses a snapshot step while status is `active`.
- A completed workout has no active step and no `restEndsAt`.
- `restEndsAt` exists only for an active rest step.
- Completing a step advances exactly once or completes the session.
- Exercise and rest catalog deletion must not invalidate existing snapshots.
