# Workout session

Pure state machine for running a resolved workout template. It has no UI,
storage, clock, or timer dependencies.

## Public API

- `createActiveWorkoutSession(template)` validates a non-empty template and
  creates an independent `not_started` snapshot.
- `startWorkout(session, now)` activates the first exercise or rest step.
- `completeCurrentExercise(session, now)` advances an exercise session.
- `completeCurrentRest(session, now)` advances the active rest step for either
  automatic expiry or manual skipping.
- `extendCurrentRest(session, seconds)` moves the active deadline forward.
- `getRemainingRestSeconds(restEndsAt, now)` and
  `isRestFinished(restEndsAt, now)` derive countdown state from explicit time.
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

`restEndsAt` is the countdown source of truth. The domain calculates and moves
the deadline but never reads the clock or schedules a browser timer. Remaining
seconds are derived rather than persisted.

## States

`ActiveWorkoutSession` is a discriminated union with `not_started`, `exercise`,
`rest`, and `completed` states. Only the `rest` state has `restEndsAt`; only the
`completed` state has `completedAt`.

## Explicit series and working weights

`resolveWorkoutTemplate` in the parent domain expands series and supersets
before session creation. Resolved exercise steps carry `set` metadata with a
series ID, number and total. `getSetProgress` derives the counter and last-set
marker from it. `getNextExercise` skips rest in the saved execution order.
`setSessionExerciseWeight` updates every matching exercise in a snapshot;
persistence atomically updates the catalog too. No per-set history is kept.

## Temporary order

Resolved steps retain their execution `block` ID/type. `getSessionReorderBlocks`
projects contiguous ranges into standalone series and supersets. `getSessionOrder`
creates a session-only draft plan; `reorderSession` validates and applies it.
Future blocks move as whole ranges with every set and internal rest. The block
containing the active step is pinned, even on its first set. Completed steps and
the active exercise/rest are an immutable prefix.

Superset member permutations sort only pending exercise slots by round and
requested series rank. Rest slots are unchanged. Optional session-only
`block.seriesOrder` retains the chosen rank after a partial round, so reopening
the editor or another reorder cannot infer the wrong order from completed sets.
Set IDs, numbers/totals and resolved exercise values stay with each set.

Explicit rests without block metadata stay at their boundary ordinal while
future block ranges replace those slots. Leading/trailing explicit rests remain
explicit; no pause is inserted, dropped or resized. Absolute active rest deadlines
and origins are unchanged. Legacy snapshots without block metadata remain runnable
but cannot be reordered safely. An unchanged plan preserves the exact old order.

The feature keeps a local draft and revalidates against the latest live session
at Apply, including after rest expiry. It persists one snapshot through the
existing session repository before showing the saved order. Templates and catalogs
are untouched. See [session order](../../../docs/session-order.md) for mobile QA.
