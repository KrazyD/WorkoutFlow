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

## WorkoutTemplate

A reusable workout plan.

- `id`: stable unique identifier.
- `name`: non-empty display name.
- `steps`: ordered list of `WorkoutStep` values.

A template must contain at least one step before it can be started.

## WorkoutStep

A discriminated union with two variants:

- `exercise`: references an `Exercise` by identifier.
- `rest`: references a `RestPreset` by identifier.

Order is represented by position in `WorkoutTemplate.steps`, not by a mutable
order field.

## ActiveWorkout

The state of one running workout.

- `templateSnapshot`: immutable workout data required to finish the session.
- `currentStepIndex`: zero-based position of the active step.
- `startedAt`: explicit start timestamp.
- `status`: `active` or `completed`.
- `restEndsAt`: end timestamp when the active step is rest; absent otherwise.

The snapshot prevents later catalog or template edits from changing an active
session. It should contain resolved exercise and rest details instead of live
catalog references.

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
