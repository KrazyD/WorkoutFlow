# Database

Dexie adapters implement feature-owned ports. Components never import Dexie.

`workout-flow` schema v4 has `exercises`, `restPresets`, `workoutTemplates`
(indexed by ID and name), and `activeWorkoutSessions` (fixed `active` ID).
Series/group metadata and exercise weights/repetitions are unindexed record properties;
this change needs no schema bump, migration or reset. No data is deleted.

`updateExerciseWeight` writes the catalog weight and every matching exercise in
the active snapshot in one transaction. `updateExerciseReps` applies the same transaction to repetitions.
Session deadlines remain absolute; an optional rest origin supports the ring.

Backup v2 validates all entities, nested series IDs, counts, weights, optional repetitions and
references before restore. A single transaction replaces catalogs and locks
the active-session table. Existing sessions block import and are never imported.
Settings-write errors abort the transaction; rollback of localStorage after an
IndexedDB commit failure is best effort. See `docs/domain-model.md` and
`docs/architecture.md` for compatibility and backup details.
