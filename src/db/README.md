# Database

Local persistence adapters implemented with Dexie. React components depend on
feature-owned repository interfaces and never import the database instance or
Dexie directly.

## Schema

Database name: `workout-flow`

Version 1 contains:

- `exercises` — primary key `id`, with an index on `name`.

Version 2 retains `exercises` and adds:

- `restPresets` — primary key `id`, with an index on `name`.

Future schema changes must add a new `version()` declaration and an explicit
migration when stored records need transformation.

## Backup restore

`DexieWorkoutDataBackupService` is the infrastructure adapter for the backup
feature. It reads exportable entities through feature repository ports and
performs a confirmed restore directly against all three catalog tables in one
Dexie transaction. The `activeWorkoutSessions` table is deliberately outside
that transaction and blocks restore when it contains a current session.
