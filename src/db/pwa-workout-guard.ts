import { liveQuery } from 'dexie'
import type { WorkoutUpdateGuard } from '../features/pwa/pwa-controller'
import { workoutFlowDatabase } from './database'

// Observe persistence without changing the session repositories or schema.
export const pwaWorkoutGuard: WorkoutUpdateGuard = {
  async isBlocked() {
    const stored = await workoutFlowDatabase.activeWorkoutSessions.get('active')
    return !!stored && stored.session.status !== 'completed'
  },
  subscribe(listener) {
    const subscription = liveQuery(() => pwaWorkoutGuard.isBlocked()).subscribe(
      {
        next: listener,
        error: () => listener(true),
      },
    )
    return () => subscription.unsubscribe()
  },
}
