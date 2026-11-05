import type { Exercise } from '../../domain/workout-session'
import type { WorkoutImportOptions } from './workout-data-backup'

export class AmbiguousExerciseImportError extends Error {}

export const normalizeExerciseName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').toLowerCase()

/** Import IDs and references stay intact; only the latest working values merge. */
export function mergeImportedExercises(
  incoming: readonly Exercise[],
  existing: readonly Exercise[],
  options: WorkoutImportOptions = {},
): { readonly exercises: readonly Exercise[]; readonly matchedCount: number } {
  const byName = new Map<string, Exercise[]>()
  for (const exercise of existing) {
    const name = normalizeExerciseName(exercise.name)
    byName.set(name, [...(byName.get(name) ?? []), exercise])
  }
  const seen = new Set<string>()
  let matchedCount = 0
  const exercises = incoming.map((exercise): Exercise => {
    const name = normalizeExerciseName(exercise.name)
    const matches = byName.get(name) ?? []
    if (seen.has(name) || matches.length > 1) {
      throw new AmbiguousExerciseImportError(
        `Неоднозначное название упражнения «${exercise.name}». Сделайте названия уникальными в справочнике и файле, затем повторите импорт.`,
      )
    }
    seen.add(name)
    const current = matches[0]
    if (!current) return exercise
    matchedCount++
    return {
      ...exercise,
      lastWeightKg: options.overwriteWorkingValues
        ? (exercise.lastWeightKg ?? current.lastWeightKg)
        : current.lastWeightKg,
      lastReps: options.overwriteWorkingValues
        ? (exercise.lastReps ?? current.lastReps)
        : current.lastReps,
    }
  })
  return { exercises, matchedCount }
}
