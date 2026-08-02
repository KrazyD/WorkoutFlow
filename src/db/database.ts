import Dexie, { type EntityTable } from 'dexie'

import type { Exercise } from '../domain/workout-session'

export class WorkoutFlowDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>

  constructor() {
    super('workout-flow')

    this.version(1).stores({
      exercises: 'id, name',
    })
  }
}

export const workoutFlowDatabase = new WorkoutFlowDatabase()
