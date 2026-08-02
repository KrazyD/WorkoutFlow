import { describe, expect, it } from 'vitest'

import {
  EXERCISE_DESCRIPTION_MAX_LENGTH,
  EXERCISE_NAME_MAX_LENGTH,
  validateExerciseForm,
} from './exercise-form'

describe('validateExerciseForm', () => {
  it('trims input and omits an empty description', () => {
    expect(
      validateExerciseForm({
        name: '  Планка  ',
        description: '   ',
      }),
    ).toEqual({
      success: true,
      value: { name: 'Планка' },
    })
  })

  it('rejects a name longer than 100 characters', () => {
    const result = validateExerciseForm({
      name: 'a'.repeat(EXERCISE_NAME_MAX_LENGTH + 1),
      description: '',
    })

    expect(result).toEqual({
      success: false,
      errors: {
        name: 'Название должно содержать не более 100 символов.',
      },
    })
  })

  it('rejects a description longer than 500 characters', () => {
    const result = validateExerciseForm({
      name: 'Планка',
      description: 'a'.repeat(EXERCISE_DESCRIPTION_MAX_LENGTH + 1),
    })

    expect(result).toEqual({
      success: false,
      errors: {
        description: 'Описание должно содержать не более 500 символов.',
      },
    })
  })
})
