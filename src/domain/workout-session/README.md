# Workout session

Pure state machine for running a resolved workout template. It has no UI,
storage, clock, or timer dependencies.

## Public API

- `createActiveWorkoutSession(template)` validates a non-empty template and
  creates an independent `not_started` snapshot.
- `startWorkout(session, now)` activates the first exercise or rest step.
- `completeCurrentExercise(session, now)` advances an exercise session.
- `completeCurrentRest(session, now)` manually advances the active rest step.
- `getCurrentStep(session)` returns the active step.
- `getNextStep(session)` returns the upcoming step. Before start, this is the
  first step; after completion, it is absent.
- `isWorkoutCompleted(session)` is a typed completed-state guard.

All transition operations return `OperationResult`. Failures contain a
`WorkoutSessionError` code and never mutate the supplied session. Timestamps
are milliseconds since Unix epoch and are always supplied by the caller.

`WorkoutStep` embeds the resolved `Exercise` or `RestPreset` value. Creating a
session deep-copies these values into `templateSnapshot`, so later catalog or
template edits cannot alter a running workout.

The current product does not run a countdown. `restEndsAt` is retained for a
future timer but does not prevent the explicit manual rest action.

## States

`ActiveWorkoutSession` is a discriminated union with `not_started`, `exercise`,
`rest`, and `completed` states. Only the `rest` state has `restEndsAt`; only the
`completed` state has `completedAt`.
