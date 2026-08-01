# Workout flow

## Session lifecycle

1. The user chooses a valid `WorkoutTemplate`.
2. The application resolves its references into an immutable template
   snapshot.
3. The caller supplies the current time to `startWorkout`.
4. The engine activates the first step. If it is rest, the engine derives
   `restEndsAt` from the supplied time and snapshot duration.
5. The UI renders the active step and, when available, the next step.
6. An exercise advances only after an explicit completion action.
7. A rest advances when the caller supplies a time at or after `restEndsAt`.
8. Advancing past the final step changes status to `completed`.

## Planned domain operations

The precise API will be introduced with the feature, but the engine is expected
to expose pure operations equivalent to:

- start a workout from a resolved snapshot and explicit current time;
- complete the active exercise at an explicit current time;
- advance an expired rest at an explicit current time;
- calculate remaining rest seconds from state and explicit current time;
- select the current and next steps without mutating state.

Each operation returns new state. It does not persist data, schedule timers,
read the clock, or trigger UI effects.

## Rest timing

`restEndsAt` is stored as an absolute timestamp so a session remains correct
when the tab is backgrounded and browser intervals are throttled. A UI interval
only requests a fresh render; it is not the source of truth. Remaining time is
derived from `restEndsAt - now` and clamped at zero.

## Interruption and restoration

Persistence of an active session is a later feature. When added, restoration
will load the snapshot and timestamps, read the current time at the application
edge, and ask the domain engine for the appropriate state. No missed timer ticks
need to be replayed.

## Invalid actions

The engine must reject or return unchanged state for transitions that do not
match the active step, such as completing an exercise during rest or advancing
a rest before its deadline. The exact error-result convention will be chosen
when these operations are implemented.
