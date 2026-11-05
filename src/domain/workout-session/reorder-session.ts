import type {
  ActiveWorkoutSession,
  ExerciseWorkoutStep,
  OperationResult,
  WorkoutStep,
} from './types'

export interface ReorderSeries {
  readonly id: string
  readonly step: ExerciseWorkoutStep
  readonly remainingSets: number
}

export interface ReorderBlock {
  readonly id: string
  readonly type: 'exercise' | 'superset'
  readonly pinned: boolean
  readonly series: readonly ReorderSeries[]
}

export interface SessionOrder {
  readonly blocks: readonly {
    readonly id: string
    readonly seriesIds: readonly string[]
  }[]
}

interface BlockSpan {
  readonly id: string
  readonly start: number
  readonly end: number
  readonly steps: readonly WorkoutStep[]
}

/** Never infer grouping for old snapshots that lack execution metadata. */
function readSpans(session: ActiveWorkoutSession): BlockSpan[] | undefined {
  if (session.status !== 'exercise' && session.status !== 'rest') return
  const steps = session.templateSnapshot.steps
  const spans: BlockSpan[] = []
  const seen = new Set<string>()
  for (let index = 0; index < steps.length;) {
    const step = steps[index]
    if (!step.block) {
      if (step.type === 'exercise') return
      index++
      continue
    }
    const id = step.block.id
    if (seen.has(id)) return
    seen.add(id)
    const start = index++
    while (index < steps.length && steps[index].block?.id === id) index++
    const content = steps.slice(start, index)
    if (
      !content.some((item) => item.type === 'exercise') ||
      content.some((item) => item.type === 'exercise' && !item.set)
    )
      return
    spans.push({ id, start, end: index, steps: content })
  }
  return spans
}

export function getSessionReorderBlocks(
  session: ActiveWorkoutSession,
): readonly ReorderBlock[] {
  return (readSpans(session) ?? [])
    .filter((span) => span.end > session.currentStepIndex)
    .map((span) => {
      const series = new Map<string, ReorderSeries>()
      span.steps.forEach((step, offset) => {
        if (step.type !== 'exercise' || !step.set) return
        const previous = series.get(step.set.seriesId)
        series.set(step.set.seriesId, {
          id: step.set.seriesId,
          step: previous?.step ?? step,
          remainingSets:
            (previous?.remainingSets ?? 0) +
            (span.start + offset >= session.currentStepIndex ? 1 : 0),
        })
      })
      const savedOrder = span.steps.at(-1)?.block?.seriesOrder
      const ids = savedOrder ?? [...series.keys()]
      return {
        id: span.id,
        type: span.steps[0].block!.type,
        pinned: span.start <= session.currentStepIndex,
        series: ids.map((id) => series.get(id)!).filter(Boolean),
      }
    })
}

export function getSessionOrder(session: ActiveWorkoutSession): SessionOrder {
  return {
    blocks: getSessionReorderBlocks(session).map((block) => ({
      id: block.id,
      seriesIds: block.series.map((series) => series.id),
    })),
  }
}

function isPermutation(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((id) => expected.includes(id))
  )
}

/** Reorder only the suffix after the active step; rest slots stay between sets.
 * Explicit (unowned) rests stay at their boundary ordinal, including trailing
 * rests. Internal rests travel with their entire block. No rest is synthesized.
 */
export function reorderSession(
  session: ActiveWorkoutSession,
  order: SessionOrder,
): OperationResult<ActiveWorkoutSession> {
  const spans = readSpans(session)
  const blocks = getSessionReorderBlocks(session)
  const unsafe = { success: false, error: { code: 'UNSAFE_REORDER' } } as const
  if (
    !spans ||
    !blocks.length ||
    !isPermutation(
      order.blocks.map((b) => b.id),
      blocks.map((b) => b.id),
    )
  )
    return unsafe
  for (const [index, block] of blocks.entries()) {
    const requested = order.blocks.find((item) => item.id === block.id)!
    if (
      (block.pinned && order.blocks[index].id !== block.id) ||
      !isPermutation(
        requested.seriesIds,
        block.series.map((item) => item.id),
      )
    )
      return unsafe
  }
  const future = order.blocks.filter(
    (block) => !blocks.find((item) => item.id === block.id)!.pinned,
  )
  let futureIndex = 0
  let cursor = 0
  const result: WorkoutStep[] = []
  for (const slot of spans) {
    result.push(...session.templateSnapshot.steps.slice(cursor, slot.start))
    const sourceId =
      slot.start > session.currentStepIndex ? future[futureIndex++].id : slot.id
    const source = spans.find((span) => span.id === sourceId)!
    const requested = order.blocks.find((block) => block.id === source.id)
    const changedOrder = requested?.seriesIds.some(
      (id, index) =>
        id !== blocks.find((block) => block.id === source.id)!.series[index].id,
    )
    if (!requested || !changedOrder) result.push(...source.steps)
    else {
      const rank = new Map(requested.seriesIds.map((id, index) => [id, index]))
      const editable = source.steps.filter(
        (step, index): step is ExerciseWorkoutStep =>
          step.type === 'exercise' &&
          source.start + index > session.currentStepIndex,
      )
      editable.sort(
        (a, b) =>
          a.set!.number - b.set!.number ||
          rank.get(a.set!.seriesId)! - rank.get(b.set!.seriesId)!,
      )
      let exerciseIndex = 0
      source.steps.forEach((step, index) => {
        if (source.start + index <= session.currentStepIndex) result.push(step)
        else {
          const next =
            step.type === 'exercise' ? editable[exerciseIndex++] : step
          result.push({
            ...next,
            block: { ...next.block!, seriesOrder: [...requested.seriesIds] },
          })
        }
      })
    }
    cursor = slot.end
  }
  result.push(...session.templateSnapshot.steps.slice(cursor))
  return {
    success: true,
    value: {
      ...session,
      templateSnapshot: { ...session.templateSnapshot, steps: result },
    },
  }
}
