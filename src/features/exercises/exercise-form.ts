import type {
  CreateExerciseInput,
  UpdateExerciseInput,
} from './exercise-repository'

export const EXERCISE_NAME_MAX_LENGTH = 100
export const EXERCISE_DESCRIPTION_MAX_LENGTH = 500

export interface ExerciseFormValues {
  readonly name: string
  readonly description: string
}

export interface ExerciseFormErrors {
  readonly name?: string
  readonly description?: string
}

export type ExerciseFormResult =
  | {
      readonly success: true
      readonly value: CreateExerciseInput | UpdateExerciseInput
    }
  | { readonly success: false; readonly errors: ExerciseFormErrors }

export function validateExerciseForm(
  values: ExerciseFormValues,
): ExerciseFormResult {
  const name = values.name.trim()
  const description = values.description.trim()
  const errors: { name?: string; description?: string } = {}

  if (name.length === 0) {
    errors.name = 'Введите название упражнения.'
  } else if (name.length > EXERCISE_NAME_MAX_LENGTH) {
    errors.name = `Название должно содержать не более ${EXERCISE_NAME_MAX_LENGTH} символов.`
  }

  if (description.length > EXERCISE_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Описание должно содержать не более ${EXERCISE_DESCRIPTION_MAX_LENGTH} символов.`
  }

  if (errors.name || errors.description) {
    return { success: false, errors }
  }

  return {
    success: true,
    value: {
      name,
      ...(description ? { description } : {}),
    },
  }
}
