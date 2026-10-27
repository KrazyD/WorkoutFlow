# Domain model

## Catalogs

`Exercise` has an ID, name, optional description and optional `lastWeightKg`.
Missing or null weight means unspecified. Weight is a finite, nonnegative
number of kilograms. It is the latest value, not a per-set result or history.
`RestPreset` has an ID, name and integer `durationSeconds` (5–3,600).

## Templates and series

`WorkoutTemplateRecord.steps` is an ordered list of blocks:

- `exercise`: a series with its own stable `id`, `exerciseId`, `setCount`
  (1–100), and optional `restPresetId` for rest between sets.
- `superset`: a block with its own ID, at least two ordered exercise series,
  and optional `restPresetId` for rest between every pair of performed sets.
- `rest`: an explicit rest preset reference, useful between blocks.

An omitted set count means one set. Omitted rest means no automatic rest.
Superset rest is controlled by the block; individual series rest is unused
inside supersets. Series IDs are unique within a template, including nested
series. Reusing an exercise in another block creates a separate series.

`resolveWorkoutTemplate` resolves catalog references and expands blocks into
one linear sequence before starting. For A × 3 and B × 3 it produces
A1, rest, B1, rest, A2, rest, B2, rest, A3, rest, B3. A series with fewer sets
is skipped in later rounds. There is no automatic rest after a block's final
set; add an explicit rest block when needed. Missing references or invalid
counts prevent starting. Catalog deletion never changes a running snapshot.

## Session

The existing deterministic execution engine runs only the expanded sequence;
there is no separate superset state machine. Exercise steps contain resolved
exercise data and explicit `set: { seriesId, number, total }` metadata. A
session stores `templateSnapshot`, `currentStepIndex`, `startedAt` and a
`not_started`, `exercise`, `rest`, or `completed` status. Rest alone has
`restEndsAt`; completed state alone has `completedAt`.

`getSetProgress` returns the current number, total and `isLast` from the same
metadata. It never counts matching names or IDs across a template.
`getNextExercise` scans forward in the active snapshot, skipping rest. It may
return another set of the same exercise, or undefined at the end.

A session is saved under the fixed `active` IndexedDB key. Its metadata,
exercise weights, current index and absolute deadline survive reload.
`setSessionExerciseWeight` immutably updates every occurrence of an exercise
in that snapshot, including other series of the same exercise. The database
adapter writes the snapshot and catalog weight together in one transaction.
The latest catalog weights are read again when a new workout starts. Clearing
weight stores null. Editing exercise name/description preserves its weight.
If an exercise was deleted during a session, its snapshot remains editable
but there is no longer a catalog record to update for future workouts.

No completed-set results, workout statistics or progression history are kept.

## Storage compatibility

IndexedDB stays at schema version 4: no tables or indexes change; the new fields
are ordinary record properties. No data is deleted or reset. Existing exercise
steps without counts are independent one-set series. Existing active snapshots
without set metadata show 1 of 1. The same execution engine handles them.
Old manually repeated steps are never guessed to be one series; edit them into
an explicit series or superset to obtain a multi-set counter.

JSON backup uses `workout-flow-export` version 2 and includes catalogs, weights,
all series/group IDs, set counts, rest references, template order and feedback
settings. It excludes active sessions. JSON v1 is rejected with a clear message.

## Time and boundaries

IDs are created outside the domain. Time is passed explicitly in milliseconds
since Unix epoch. Domain code never reads browser APIs or the wall clock.
Remaining rest seconds are `max(0, ceil((restEndsAt - now) / 1000))`.
Completing a step advances exactly once; browser intervals, storage and feedback
belong to the application edge.
