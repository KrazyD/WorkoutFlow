import Dexie, { type EntityTable } from 'dexie'

import type { Exercise, RestPreset } from '../domain/workout-session'
import type { WorkoutTemplateRecord } from '../domain/workout-template'
import type { StoredActiveWorkoutSession } from './dexie-active-workout-session-repository'

export class WorkoutFlowDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  restPresets!: EntityTable<RestPreset, 'id'>
  workoutTemplates!: EntityTable<WorkoutTemplateRecord, 'id'>
  activeWorkoutSessions!: EntityTable<StoredActiveWorkoutSession, 'id'>

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

    this.version(4).stores({
      exercises: 'id, name',
      restPresets: 'id, name',
      workoutTemplates: 'id, name',
      activeWorkoutSessions: 'id',
    })
  }
}

export const workoutFlowDatabase = new WorkoutFlowDatabase()
