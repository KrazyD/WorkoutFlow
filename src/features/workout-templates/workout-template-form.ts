import type { WorkoutTemplateStep } from '../../domain/workout-template'
import type {
  CreateWorkoutTemplateInput,
  UpdateWorkoutTemplateInput,
} from './workout-template-repository'

export const WORKOUT_TEMPLATE_NAME_MAX_LENGTH = 100

export interface WorkoutTemplateFormValues {
  readonly name: string
  readonly steps: readonly WorkoutTemplateStep[]
}

export interface WorkoutTemplateFormErrors {
  readonly name?: string
  readonly steps?: string
}

export type WorkoutTemplateFormResult =
  | {
      readonly success: true
      readonly value: CreateWorkoutTemplateInput | UpdateWorkoutTemplateInput
    }
  | { readonly success: false; readonly errors: WorkoutTemplateFormErrors }

export function validateWorkoutTemplateForm(
  values: WorkoutTemplateFormValues,
): WorkoutTemplateFormResult {
  const name = values.name.trim()
  const errors: { name?: string; steps?: string } = {}

  if (name.length === 0) {
    errors.name = 'Введите название тренировки.'
  } else if (name.length > WORKOUT_TEMPLATE_NAME_MAX_LENGTH) {
    errors.name = `Название должно содержать не более ${WORKOUT_TEMPLATE_NAME_MAX_LENGTH} символов.`
  }

  if (values.steps.length === 0) {
    errors.steps = 'Добавьте хотя бы один шаг.'
  }

  if (errors.name || errors.steps) {
    return { success: false, errors }
  }

  return { success: true, value: { name, steps: values.steps } }
}
