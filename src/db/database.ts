import Dexie, { type EntityTable } from 'dexie'

import type { Exercise, RestPreset } from '../domain/workout-session'

export class WorkoutFlowDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  restPresets!: EntityTable<RestPreset, 'id'>

  constructor(databaseName = 'workout-flow') {
    super(databaseName)

    this.version(1).stores({
      exercises: 'id, name',
    })

    this.version(2).stores({
      exercises: 'id, name',
      restPresets: 'id, name',
    })
  }
}

export const workoutFlowDatabase = new WorkoutFlowDatabase()
