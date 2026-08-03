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
adapter. Schema version 1 introduced `exercises`; version 2 added
`restPresets`; version 3 added `workoutTemplates`; version 4 retains those
tables and adds `activeWorkoutSessions`. The active-session repository uses the
fixed `active` primary key, so at most one current session can exist. Workout
template steps store catalog identifiers rather than embedded catalog records.
Later schema changes must use additional Dexie versions and explicit migrations
when records need transformation.

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
During rest, the persisted `restEndsAt` timestamp is the source of truth. React
uses one browser interval to refresh the current timestamp and derives the
displayed seconds from the deadline; it does not persist a decreasing counter.
The interval is cleaned up when the rest screen is left or unmounted.

Rest duration is stored as integer `durationSeconds`. The rest preset feature
converts the form's minute and second fields to this domain value before calling
the repository and decomposes it when editing. Human-readable Russian duration
formatting is a pure feature-level function.

Rest-finished feedback is an application-edge side effect rather than a domain
operation. Feedback preferences are stored separately from workout entities in
`localStorage` under `workout-flow.feedback-settings.v1`. A shared audio service
keeps one lazy `AudioContext` and synthesizes a short two-tone signal with the
Web Audio API; explicit Start and sound-preview button presses attempt to
prepare or resume it. Vibration uses capability detection for
`navigator.vibrate`. Unsupported or blocked feedback never prevents the
existing rest transition or its persistence.

The active-workout feature resolves template references before calling the
domain engine. React receives repositories through dependency injection and
commits each domain transition to IndexedDB before rendering the new step.
An expired restored rest is completed and persisted before the next step is
shown. A failed completion remains on the rest screen and requires an explicit
retry rather than starting an automatic retry loop.

## Deferred decisions

The project deliberately has no form library, schema validator, component kit,
end-to-end test runner, PWA plugin, or state manager. Each choice should follow
a concrete requirement rather than precede it.
