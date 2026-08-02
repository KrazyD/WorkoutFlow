import type { WorkoutTemplateStep } from '../../domain/workout-template'

export function addStep(
  steps: readonly WorkoutTemplateStep[],
  step: WorkoutTemplateStep,
): WorkoutTemplateStep[] {
  return [...steps, step]
}

export function removeStep(
  steps: readonly WorkoutTemplateStep[],
  stepId: string,
): WorkoutTemplateStep[] {
  return steps.filter((step) => step.id !== stepId)
}

function moveStep(
  steps: readonly WorkoutTemplateStep[],
  index: number,
  targetIndex: number,
): WorkoutTemplateStep[] {
  const result = [...steps]

  if (
    index < 0 ||
    index >= result.length ||
    targetIndex < 0 ||
    targetIndex >= result.length
  ) {
    return result
  }

  const current = result[index]
  const target = result[targetIndex]

  if (!current || !target) {
    return result
  }

  result[index] = target
  result[targetIndex] = current
  return result
}

export function moveStepUp(
  steps: readonly WorkoutTemplateStep[],
  stepId: string,
): WorkoutTemplateStep[] {
  const index = steps.findIndex((step) => step.id === stepId)
  return moveStep(steps, index, index - 1)
}

export function moveStepDown(
  steps: readonly WorkoutTemplateStep[],
  stepId: string,
): WorkoutTemplateStep[] {
  const index = steps.findIndex((step) => step.id === stepId)
  return moveStep(steps, index, index + 1)
}
