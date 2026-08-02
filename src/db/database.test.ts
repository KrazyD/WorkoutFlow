import { describe, expect, it } from 'vitest'

import { WorkoutFlowDatabase } from './database'

describe('WorkoutFlowDatabase schema', () => {
  it('keeps catalog tables and adds workout templates in schema version 3', () => {
    const database = new WorkoutFlowDatabase('workout-flow-schema-test')

    expect(database.verno).toBe(3)
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'exercises',
      'restPresets',
      'workoutTemplates',
    ])

    database.close()
  })
})
