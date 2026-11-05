import { getCurrentStep } from './workout-session'
import type {
  ActiveWorkoutSession,
  ExerciseWorkoutStep,
  OperationResult,
  WorkoutStep,
} from './types'

export interface ReorderOption {
  readonly seriesId: string
  readonly step: ExerciseWorkoutStep
  readonly remainingSets: number
}

/** Supersets can reorder their own series; standalone series travel as a unit. */
export function getSessionReorderOptions(
  session: ActiveWorkoutSession,
): readonly ReorderOption[] {
  const current = getCurrentStep(session)
  if (
    session.status !== 'exercise' ||
    current?.type !== 'exercise' ||
    !current.block ||
    !current.set
  )
    return []
  const options = new Map<string, ReorderOption>()
  for (const step of session.templateSnapshot.steps.slice(
    session.currentStepIndex + 1,
  )) {
    if (
      step.type !== 'exercise' ||
      !step.set ||
      !step.block ||
      step.set.seriesId === current.set.seriesId
    )
      continue
    const allowed =
      current.block.type === 'superset'
        ? step.block.id === current.block.id && step.block.type === 'superset'
        : step.block.type === 'exercise' && step.block.id !== current.block.id
    if (!allowed) continue
    const previous = options.get(step.set.seriesId)
    options.set(step.set.seriesId, {
      seriesId: step.set.seriesId,
      step: previous?.step ?? step,
      remainingSets: (previous?.remainingSets ?? 0) + 1,
    })
  }
  return [...options.values()].filter(
    (option) =>
      current.block?.type !== 'superset' ||
      option.step.set?.number === current.set?.number,
  )
}

export function swapSessionExercises(
  session: ActiveWorkoutSession,
  seriesId: string,
): OperationResult<ActiveWorkoutSession> {
  const current = getCurrentStep(session)
  const target = getSessionReorderOptions(session).find(
    (option) => option.seriesId === seriesId,
  )
  if (
    session.status !== 'exercise' ||
    current?.type !== 'exercise' ||
    !current.block ||
    !current.set ||
    !target?.step.block
  ) {
    return { success: false, error: { code: 'UNSAFE_REORDER' } }
  }
  const steps = session.templateSnapshot.steps
  const start = session.currentStepIndex
  const endOfBlock = (from: number) => {
    const id = steps[from]?.block?.id
    let end = from + 1
    while (end < steps.length && steps[end]?.block?.id === id) end++
    return end
  }
  let reordered: readonly WorkoutStep[]
  if (current.block.type === 'exercise') {
    const targetStart = steps.findIndex(
      (step, index) =>
        index > start && step.block?.id === target.step.block?.id,
    )
    const currentEnd = endOfBlock(start)
    const targetEnd = endOfBlock(targetStart)
    reordered = [
      ...steps.slice(0, start),
      ...steps.slice(targetStart, targetEnd),
      ...steps.slice(currentEnd, targetStart),
      ...steps.slice(start, currentEnd),
      ...steps.slice(targetEnd),
    ]
  } else {
    const end = endOfBlock(start)
    const pending = steps.slice(start, end)
    const exercises = pending.filter(
      (step): step is ExerciseWorkoutStep => step.type === 'exercise',
    )
    // Exchange the two series in each remaining round, preserving every other
    // member's position. This also works after previous swaps and partial rounds.
    const rounds = new Set(exercises.map((step) => step.set!.number))
    for (const round of rounds) {
      const left = exercises.findIndex(
        (step) =>
          step.set!.number === round &&
          step.set!.seriesId === current.set!.seriesId,
      )
      const right = exercises.findIndex(
        (step) => step.set!.number === round && step.set!.seriesId === seriesId,
      )
      if (left >= 0 && right >= 0) {
        const saved = exercises[left]!
        exercises[left] = exercises[right]!
        exercises[right] = saved
      }
    }
    let index = 0
    reordered = [
      ...steps.slice(0, start),
      ...pending.map((step) =>
        step.type === 'exercise' ? exercises[index++]! : step,
      ),
      ...steps.slice(end),
    ]
  }
  return {
    success: true,
    value: {
      ...session,
      templateSnapshot: { ...session.templateSnapshot, steps: reordered },
    },
  }
}
