# AGENTS.md

## Project

Workout Flow is a mobile-first, local-only React application for running a
predefined sequence of exercise and rest steps. User-facing text is Russian;
source code, identifiers, comments, commit messages, and repository
documentation are English.

## Commands

- `pnpm dev` — start the Vite development server.
- `pnpm typecheck` — run strict TypeScript checks.
- `pnpm lint` — run ESLint with zero warnings allowed.
- `pnpm test` — run unit tests once.
- `pnpm build` — create a production build.
- `pnpm check` — run typecheck, lint, tests, and build in sequence.

Run `pnpm check` before handing off a change.

## Architecture

- `src/domain` contains pure business logic and domain types.
- `src/domain/workout-session` contains the workout execution engine.
- `src/features` contains user scenarios and their UI orchestration.
- `src/db` contains local persistence adapters.
- `src/shared` contains reusable components and utilities.

Dependencies point inward: features may use domain, database, and shared code;
infrastructure may implement contracts owned by inner layers. Domain code must
not import React, Dexie, IndexedDB, DOM APIs, or browser timers. Pass the current
time explicitly to domain functions; never call `Date.now()` in domain logic.

## Development rules

- Keep TypeScript strict and prefer explicit domain types over unvalidated
  primitives at boundaries.
- Keep domain logic deterministic and independently unit-testable.
- Do not add a dependency until a concrete feature uses it.
- Keep tests next to the code they cover unless shared test support is needed.
- Preserve mobile-first layout and accessible semantic HTML.
- Do not add backend, authentication, synchronization, PWA, or progression
  tracking without a separate product decision.
