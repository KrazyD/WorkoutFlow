# Domain model

## Catalogs

`Exercise` has an ID, name, optional description, optional `lastWeightKg` and optional `lastReps`.
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

`lastReps` is a positive safe integer or null/omitted (unspecified). It is not
extracted from descriptions. `setSessionExerciseReps` updates all occurrences
of the exercise, just like weight; its repository method commits snapshot and
catalog in one transaction. Clearing stores null. Catalog name/description
edits preserve both values, and newly resolved workouts read the latest values.
Old v2 JSON backups without `lastReps` remain valid; export includes it when
present and import rejects fractional, zero, negative or unsafe integers.

`getWorkingSetProgress` counts only exercise steps in the resolved snapshot.
`completed` counts exercise steps before the saved current index; `current`
adds one only during exercise. `total` counts every exercise step. This supports
unequal superset series and restored legacy snapshots without guessing groups.
`countTemplateWorkingSets` sums series counts (default 1), including all nested
superset series, and ignores explicit rest blocks for catalog cards.

Rest snapshots additionally store optional `restStartedAt` for the visual ring.
Its remaining fraction is `(restEndsAt - now) / (restEndsAt - restStartedAt)`,
clamped to 0–1. Extensions keep the origin and move only the deadline. Old
snapshots infer the origin from their deadline and configured duration; the
first extension persists that inferred origin. This cannot reconstruct earlier
extensions in snapshots written before the field existed.

No completed-set results, workout statistics or progression history are kept.

## Temporary session order

The session editor projects contiguous execution `block` ranges into logical
standalone series or supersets. All future ranges can be permuted independently
of the active block. The active block is pinned; completed steps and the active
exercise/rest remain exactly unchanged. A superset member order is applied to
pending exercise slots in each remaining round, including incomplete rounds.
Optional session-only `block.seriesOrder` records the chosen member rank so
completed prefixes do not override it when reopening the editor.

Internal rests travel with their block. Explicit unowned rests retain their
boundary ordinal between execution ranges; explicit leading/trailing pauses stay
in place. No rest is synthesized or resized. The active deadline/origin and index
do not change. Series IDs, set numbers/totals, weights and repetitions travel with
each exercise. The draft supports repeated edits and Cancel without storage writes.
Apply revalidates against the live session and writes the entire snapshot as one
active-session record before rendering. Rest timers and feedback continue normally
while editing. A stale plan that would move an already started block is rejected.

Restoration uses the saved execution snapshot. The next workout resolves the
original template again. Existing snapshots without block/set metadata continue
normally but cannot reorder; no grouping is inferred from names or repeated IDs.
See [session order](session-order.md) for interaction details and validation.

## Storage compatibility

IndexedDB stays at schema version 4: no tables or indexes change; the new fields
are ordinary record properties. No data is deleted or reset. Existing exercise
steps without counts are independent one-set series. Existing active snapshots
without set metadata show 1 of 1. The same execution engine handles them.
Old manually repeated steps are never guessed to be one series; edit them into
an explicit series or superset to obtain a multi-set counter.

JSON backup uses `workout-flow-export` version 2 and includes catalogs, weights, repetitions,
all series/group IDs, set counts, rest references, template order and feedback
settings. It excludes active sessions. JSON v1 is rejected with a clear message. Import matches exercises by trimmed,
whitespace-collapsed, lowercase names, never approximately. Current working
values are retained by default; an import-only opt-in takes numeric values from
the file. Missing/null imported values preserve existing values in either mode.
Ambiguous names abort import, while new exercises retain file IDs/values and
template references. The merge reads current catalog values under the same
transaction lock as replacement. This option is not part of JSON v2.

## Time and boundaries

IDs are created outside the domain. Time is passed explicitly in milliseconds
since Unix epoch. Domain code never reads browser APIs or the wall clock.
Remaining rest seconds are `max(0, ceil((restEndsAt - now) / 1000))`.
Completing a step advances exactly once; browser intervals, storage and feedback
belong to the application edge.
