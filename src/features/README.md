# Features

User-facing workflows composed from domain rules, storage, and shared UI.

Feature modules own the repository interfaces they consume. Infrastructure in
`src/db` implements those interfaces, while components receive implementations
through explicit dependencies for isolation and testability.
