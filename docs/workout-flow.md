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
5. The UI renders the active step, series counter, last-set marker and the next
   exercise (skipping rest) with its own counter.
6. An exercise advances only after an explicit completion action.
7. A rest shows a countdown derived from its absolute `restEndsAt` deadline and
   advances automatically at zero. The user may skip it or extend the deadline
   by 30 seconds; transitions are persisted before the next step appears.
8. Advancing past the final step changes status to `completed`.

## Domain operations

The engine exposes pure operations to:

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

## Series and weight editing

See [domain model](domain-model.md) for the exact block expansion order. The
editor exposes independent set counts and a rest preset for each series or
superset. Counts must be integers from 1 to 100; supersets need two exercises.
For block transitions, insert an explicit rest if desired.

Weight accepts decimal dot or comma through an iPhone decimal keyboard. Empty
input clears the value; invalid and negative input is rejected. Save commits
both catalog and snapshot changes atomically before updating the display.
Exercise completion is disabled while weight editing is open, preventing a
step change from discarding unsaved input. Errors keep the form open to retry.


## Dark Glass navigation and workout UI

The default route opens Workouts (`/workouts`). Three bottom destinations expose
Workouts, Builder and Settings. Builder keeps `/exercises` and `/rest-presets`
as its segmented catalog routes; Settings (`/settings/data`, also reachable from
`/settings`) contains the existing feedback preferences and JSON backup UI.
`/builder` redirects to exercises. Existing direct links continue working.

`CatalogPageLayout` owns a fixed-height `100dvh` shell with a stationary header,
one scrolling content region and a bottom glass dock. Only the selected dock
item expands its icon label, using short CSS transitions; all links have
accessible names and `aria-current`. Reduced motion disables transitions.
`useVisibleViewport` adjusts the root to keyboard-induced Visual Viewport
height changes when available. Opaque panel styling is the fallback without backdrop filtering. Safe-area
padding protects the header, dock and floating controls.

The contextual plus creates a workout, exercise or rest preset. It is absent in
Settings, active sessions and while an editor is open. Bottom content padding
lets the last item scroll above both floating controls. Focused keyboard inputs hide
the dock and floating controls to avoid obscuring keyboard input. Opening an
editor scrolls its content to the top. Edited catalog cards are temporarily
filtered out without changing stored records or showing a false empty state.

Session progress displays working sets instead of engine steps, using the
snapshot calculation described in the domain model. A lime badge emphasizes
the existing last-set condition. The next exercise preview still skips rest.
`NumericValueCard` shares weight and repetitions editing, validation messages,
clear/cancel/save controls and persistence errors; completing the exercise is
disabled while either editor is open. Weight uses decimal input and repetitions
use numeric input, with empty input clearing the value.

`RestTimer` draws an SVG ring around the existing text countdown. It reads the
same current timestamp and deadline as the existing single refresh interval;
there is no second clock or timer. Adding 30 seconds expands the denominator,
and recovery calculates the actual remaining fraction. Automatic expiry,
skipping, feedback deduplication and sound/vibration paths are unchanged.
