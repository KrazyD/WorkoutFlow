# Architecture

## Goals

The architecture keeps workout rules deterministic, persistence replaceable,
and React-specific concerns at the application edge. It should remain small
until real product behavior requires more structure.

## Source layout

```text
src/
├── domain/                  Pure types and business rules
│   └── workout-session/     Workout execution engine
├── features/                User scenarios and UI orchestration
├── db/                      Local persistence adapters
└── shared/                  Shared UI and technical utilities
```

## Layer responsibilities

### Domain

`src/domain` owns entities, invariants, state transitions, and calculations.
Its functions receive all inputs explicitly and return values or domain
results without side effects.

Domain code must not import React, Dexie, IndexedDB, DOM APIs, or browser
timers. In particular, it must not call `Date.now()`, `setTimeout()`, or
`setInterval()`. Callers provide the current timestamp when a transition or
remaining-time calculation needs it.

### Features

`src/features` owns user scenarios such as managing exercises, editing a
template, and conducting a workout. A feature connects UI state, domain
operations, and persistence ports. Feature code must not duplicate domain
rules.

### Database

`src/db` owns local storage implementations, serialization, migrations, and
mapping between stored records and domain values. Dexie is the IndexedDB
adapter. Schema version 1 contains the `exercises` table with `id` as its
primary key and `name` as an index. Later schema changes must use additional
Dexie versions and explicit migrations when records need transformation.

### Shared

`src/shared` contains reusable visual components and general-purpose technical
helpers. It must not become a home for feature or domain behavior.

## Dependency direction

The domain has no dependency on the other application layers. Features may
depend on domain and shared code and use storage through explicit boundaries.
Database adapters may depend on domain types or implement persistence
contracts. Repository interfaces are owned by features; React components
receive these interfaces and never import Dexie, the database singleton, or
tables directly. Shared code must remain independent of features.

## Runtime boundaries

React renders the application and schedules UI updates. A feature-level adapter
may read the wall clock or use browser timers, then pass a numeric timestamp to
the workout-session engine. Persistence occurs outside state-transition
functions. This separation makes the engine testable with fixed time values.

## Deferred decisions

The project deliberately has no form library, schema validator, component kit,
end-to-end test runner, PWA plugin, or state manager. Each choice should follow
a concrete requirement rather than precede it.
