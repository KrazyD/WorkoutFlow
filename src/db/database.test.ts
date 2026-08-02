import { describe, expect, it } from 'vitest'

import { WorkoutFlowDatabase } from './database'

describe('WorkoutFlowDatabase schema', () => {
  it('keeps exercises and adds rest presets in schema version 2', () => {
    const database = new WorkoutFlowDatabase('workout-flow-schema-test')

    expect(database.verno).toBe(2)
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'exercises',
      'restPresets',
    ])

    database.close()
  })
})
