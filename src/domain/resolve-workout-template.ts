import type {
  WorkoutTemplateRecord,
  ExerciseWorkoutTemplateStep,
} from './workout-template'
import type {
  Exercise,
  RestPreset,
  WorkoutStep,
  WorkoutTemplate,
} from './workout-session/types'

export const MAX_SET_COUNT = 100

export function isValidSetCount(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_SET_COUNT
}

/** Expand rounds once, before starting; the session engine only runs resolved steps. */
export function resolveWorkoutTemplate(
  template: WorkoutTemplateRecord,
  exercises: readonly Exercise[],
  restPresets: readonly RestPreset[],
): WorkoutTemplate | undefined {
  const steps: WorkoutStep[] = []
  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  )
  const restById = new Map(restPresets.map((rest) => [rest.id, rest]))
  for (const block of template.steps) {
    if (block.type === 'rest') {
      const restPreset = restById.get(block.restPresetId)
      if (!restPreset) return undefined
      steps.push({ type: 'rest', restPreset })
      continue
    }
    const series: readonly ExerciseWorkoutTemplateStep[] =
      block.type === 'superset' ? block.series : [block]
    if (
      (block.type === 'superset' && series.length < 2) ||
      series.length === 0 ||
      series.some((item) => !isValidSetCount(item.setCount ?? 1))
    )
      return undefined
    const restPreset = block.restPresetId
      ? restById.get(block.restPresetId)
      : undefined
    if (block.restPresetId && !restPreset) return undefined
    const sets: WorkoutStep[] = []
    const rounds = Math.max(...series.map((item) => item.setCount ?? 1))
    for (let round = 1; round <= rounds; round++) {
      for (const item of series) {
        const exercise = exerciseById.get(item.exerciseId)
        if (!exercise) return undefined
        const total = item.setCount ?? 1
        if (round <= total)
          sets.push({
            type: 'exercise',
            exercise,
            set: { seriesId: item.id, number: round, total },
          })
      }
    }
    sets.forEach((set, index) => {
      steps.push(set)
      if (restPreset && index < sets.length - 1)
        steps.push({ type: 'rest', restPreset })
    })
  }
  return { id: template.id, name: template.name, steps }
}
