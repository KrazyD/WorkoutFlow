import { describe, expect, it } from 'vitest'

import { validateWorkoutTemplateForm } from './workout-template-form'

const step = {
  id: 'step-1',
  type: 'exercise',
  exerciseId: 'exercise-1',
} as const

describe('validateWorkoutTemplateForm', () => {
  it('trims a valid name', () => {
    expect(
      validateWorkoutTemplateForm({ name: '  Ноги  ', steps: [step] }),
    ).toEqual({
      success: true,
      value: { name: 'Ноги', steps: [step] },
    })
  })

  it('rejects a blank name and an empty sequence', () => {
    expect(validateWorkoutTemplateForm({ name: '  ', steps: [] })).toEqual({
      success: false,
      errors: {
        name: 'Введите название тренировки.',
        steps: 'Добавьте хотя бы один шаг.',
      },
    })
  })

  it('rejects a name longer than 100 characters', () => {
    expect(
      validateWorkoutTemplateForm({ name: 'a'.repeat(101), steps: [step] }),
    ).toEqual({
      success: false,
      errors: { name: 'Название должно содержать не более 100 символов.' },
    })
  })
})
