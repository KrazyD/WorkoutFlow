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
7. A rest shows a countdown derived from its absolute `restEndsAt` deadline and
   advances automatically at zero. The user may skip it or extend the deadline
   by 30 seconds; transitions are persisted before the next step appears.
8. Advancing past the final step changes status to `completed`.

## Domain operations

The precise API will be introduced with the feature, but the engine is expected
to expose pure operations equivalent to:

- start a workout from a resolved snapshot and explicit current time;
- complete the active exercise at an explicit current time;
- complete the active rest at an explicit current time, whether requested by
  the countdown or the user;
- extend the active rest deadline without mutating the supplied state;
- calculate remaining seconds and whether a deadline has passed;
- select the current and next steps without mutating state.

Each operation returns new state. It does not persist data, schedule timers,
read the clock, or trigger UI effects.

## Rest timing

`restEndsAt` is the source of truth for an active rest. It is calculated once
when the step becomes active from the snapshot duration and the caller's
current timestamp. The UI recalculates the displayed `MM:SS` value relative to
that deadline approximately once per second; it neither stores nor persists a
decreasing counter. Browser timers remain outside the domain.

Skipping rest calls the same domain completion operation as expiry. Adding 30
seconds moves `restEndsAt` forward and persists the updated session. A guarded
in-flight transition prevents timer callbacks and repeated clicks from
advancing twice. If persistence fails at expiry, the current rest remains
visible with a Russian error and an explicit retry action.

Only natural countdown expiry attempts rest-finished feedback. The application
marks the template, session start time, step index, and `restEndsAt` combination
before starting sound and vibration, then uses the existing rest completion and
persistence path. This prevents interval callbacks, React Strict Mode, and a
save retry from repeating feedback. Manual skip and workout exit are silent.

Sound is a short synthesized Web Audio signal. Because mobile browsers may
require a user gesture, the application attempts to prepare the shared
`AudioContext` from Start and from the sound-preview button. Vibration is a
feature-detected `[200, 100, 200]` pattern. Either API may be missing, blocked,
or suppressed in a background tab; this is not a workout error and background
notification is not guaranteed.

## Interruption and restoration

One session is persisted in IndexedDB under a fixed key. Reloading the template
list shows its name, saved step index, and a Continue action. Opening
`/workout-session` reads the same domain state, so refresh continues from the
persisted deadline rather than restarting the configured duration. If the
deadline passed while the application was closed or backgrounded, the UI
immediately completes and persists the rest before showing the next exercise or
workout completion. Feedback is attempted only when an expired restored rest is
at most 5 seconds late; older feedback is discarded while the transition still
completes. Starting a second template requires an explicit choice to continue
the current session, replace it, or cancel.

## Invalid actions

The engine must reject or return unchanged state for transitions that do not
match the active step, such as completing an exercise during rest or finishing
rest while an exercise is active. Operations return explicit success or
domain-error results.
