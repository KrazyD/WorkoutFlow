# Domain

Pure business rules and domain types. This layer must not import React, Dexie,
IndexedDB, DOM APIs, or browser timers. Time is always passed explicitly to
domain functions.

The workout execution engine belongs in `workout-session`.
