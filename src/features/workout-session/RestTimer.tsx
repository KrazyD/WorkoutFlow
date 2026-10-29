import {
  getRemainingRestSeconds,
  getRestRemainingFraction,
  type RestWorkoutSession,
} from '../../domain/workout-session'
import { formatCountdown } from './countdown'

export function RestTimer({
  session,
  now,
}: {
  readonly session: RestWorkoutSession
  readonly now: number
}) {
  const remaining = getRemainingRestSeconds(session.restEndsAt, now)
  const fraction = getRestRemainingFraction(session, now)
  return (
    <div className="rest-timer" role="timer" aria-label="Осталось времени">
      <svg viewBox="0 0 240 240" aria-hidden="true">
        <circle className="timer-track" cx="120" cy="120" r="106" />
        <circle
          className="timer-arc"
          cx="120"
          cy="120"
          r="106"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - fraction}
          transform="rotate(-90 120 120)"
        />
      </svg>
      <div className="timer-value">
        <span>{formatCountdown(remaining)}</span>
        <span className="text-sm font-medium text-slate-400">
          Осталось отдыха
        </span>
      </div>
    </div>
  )
}
