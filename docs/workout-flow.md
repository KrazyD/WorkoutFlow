# Workout flow

## Template preparation

The workout template editor persists catalog identifiers. Starting a workout
resolves every reference into an immutable snapshot; a template with a missing
reference cannot start and shows a user-facing error.

## Session lifecycle

1. The user chooses a valid `WorkoutTemplate`.
2. The application resolves its references into an immutable template
   snapshot.
3. The caller supplies the current time to `startWorkout`.
4. The engine activates the first step. If it is rest, the engine derives
   `restEndsAt` from the supplied time and snapshot duration.
5. The UI renders the active step and, when available, the next step.
6. An exercise advances only after an explicit completion action.
7. A rest advances after the explicit “finish rest” action. The configured
   duration remains visible but no countdown runs.
8. Advancing past the final step changes status to `completed`.

## Domain operations

The precise API will be introduced with the feature, but the engine is expected
to expose pure operations equivalent to:

- start a workout from a resolved snapshot and explicit current time;
- complete the active exercise at an explicit current time;
- manually complete the active rest at an explicit current time;
- select the current and next steps without mutating state.

Each operation returns new state. It does not persist data, schedule timers,
read the clock, or trigger UI effects.

## Rest timing

`restEndsAt` remains part of domain state for a future countdown, but the
current feature neither reads it to block the user nor schedules browser
timers. Rest duration is static until the user finishes the step manually.

## Interruption and restoration

One session is persisted in IndexedDB under a fixed key. Reloading the template
list shows its name, saved step index, and a Continue action. Opening
`/workout-session` reads the same domain state, so refresh does not reset
progress. Starting a second template requires an explicit choice to continue
the current session, replace it, or cancel.

## Invalid actions

The engine must reject or return unchanged state for transitions that do not
match the active step, such as completing an exercise during rest or finishing
rest while an exercise is active. Operations return explicit success or
domain-error results.
