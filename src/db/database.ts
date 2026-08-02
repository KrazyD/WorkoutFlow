import Dexie, { type EntityTable } from 'dexie'

import type { Exercise, RestPreset } from '../domain/workout-session'
import type { WorkoutTemplateRecord } from '../domain/workout-template'

export class WorkoutFlowDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  restPresets!: EntityTable<RestPreset, 'id'>
  workoutTemplates!: EntityTable<WorkoutTemplateRecord, 'id'>

  constructor(databaseName = 'workout-flow') {
    super(databaseName)

    this.version(1).stores({
      exercises: 'id, name',
    })

    this.version(2).stores({
      exercises: 'id, name',
      restPresets: 'id, name',
    })

    this.version(3).stores({
      exercises: 'id, name',
      restPresets: 'id, name',
      workoutTemplates: 'id, name',
    })
  }
}

export const workoutFlowDatabase = new WorkoutFlowDatabase()
