import { describe, expect, it } from 'vitest'

import { WorkoutFlowDatabase } from './database'

describe('WorkoutFlowDatabase schema', () => {
  it('keeps existing tables and adds active sessions in schema version 4', () => {
    const database = new WorkoutFlowDatabase('workout-flow-schema-test')

    expect(database.verno).toBe(4)
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'activeWorkoutSessions',
      'exercises',
      'restPresets',
      'workoutTemplates',
    ])

    database.close()
  })
})
