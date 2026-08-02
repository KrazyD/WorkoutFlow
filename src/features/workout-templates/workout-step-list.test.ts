import { describe, expect, it } from 'vitest'

import type { WorkoutTemplateStep } from '../../domain/workout-template'
import {
  addStep,
  moveStepDown,
  moveStepUp,
  removeStep,
} from './workout-step-list'

const first: WorkoutTemplateStep = {
  id: 'first',
  type: 'exercise',
  exerciseId: 'exercise-1',
}
const second: WorkoutTemplateStep = {
  id: 'second',
  type: 'rest',
  restPresetId: 'rest-1',
}
const third: WorkoutTemplateStep = {
  id: 'third',
  type: 'exercise',
  exerciseId: 'exercise-2',
}

describe('workout step list operations', () => {
  it('adds a step without changing the source array', () => {
    const source = [first]
    const result = addStep(source, second)

    expect(result).toEqual([first, second])
    expect(source).toEqual([first])
    expect(result).not.toBe(source)
  })

  it('removes a step without changing the source array', () => {
    const source = [first, second]
    const result = removeStep(source, first.id)

    expect(result).toEqual([second])
    expect(source).toEqual([first, second])
  })

  it('moves a step up', () => {
    expect(moveStepUp([first, second, third], second.id)).toEqual([
      second,
      first,
      third,
    ])
  })

  it('moves a step down', () => {
    expect(moveStepDown([first, second, third], second.id)).toEqual([
      first,
      third,
      second,
    ])
  })

  it('leaves the first step in place when moving it up', () => {
    expect(moveStepUp([first, second], first.id)).toEqual([first, second])
  })

  it('leaves the last step in place when moving it down', () => {
    expect(moveStepDown([first, second], second.id)).toEqual([first, second])
  })

  it('does not mutate the source array when moving steps', () => {
    const source = [first, second, third]
    moveStepUp(source, second.id)
    moveStepDown(source, second.id)

    expect(source).toEqual([first, second, third])
  })
})
