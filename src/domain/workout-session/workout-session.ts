import type {
  ActiveWorkoutSession,
  CompletedWorkoutSession,
  Exercise,
  ExerciseWorkoutSession,
  NotStartedWorkoutSession,
  OperationResult,
  RestPreset,
  RestWorkoutSession,
  WorkoutSessionError,
  WorkoutStep,
  WorkoutTemplate,
} from './types'

const success = <T>(value: T): OperationResult<T> => ({
  success: true,
  value,
})

const failure = <T>(error: WorkoutSessionError): OperationResult<T> => ({
  success: false,
  error,
})

const cloneExercise = (exercise: Exercise): Exercise => ({ ...exercise })

const cloneRestPreset = (restPreset: RestPreset): RestPreset => ({
  ...restPreset,
})

const cloneStep = (step: WorkoutStep): WorkoutStep => {
  if (step.type === 'exercise') {
    return {
      type: 'exercise',
      exercise: cloneExercise(step.exercise),
    }
  }

  return {
    type: 'rest',
    restPreset: cloneRestPreset(step.restPreset),
  }
}

const createTemplateSnapshot = (
  template: WorkoutTemplate,
): WorkoutTemplate => ({
  id: template.id,
  name: template.name,
  steps: template.steps.map(cloneStep),
})

export function createActiveWorkoutSession(
  template: WorkoutTemplate,
): OperationResult<NotStartedWorkoutSession> {
  if (template.steps.length === 0) {
    return failure({ code: 'EMPTY_TEMPLATE' })
  }

  return success({
    status: 'not_started',
    templateSnapshot: createTemplateSnapshot(template),
    currentStepIndex: 0,
    startedAt: null,
  })
}

const activateStep = (
  session: ActiveWorkoutSession,
  currentStepIndex: number,
  now: number,
): ExerciseWorkoutSession | RestWorkoutSession => {
  const step = session.templateSnapshot.steps[currentStepIndex]

  // The index is produced only by validated session transitions.
  if (step?.type === 'rest') {
    return {
      status: 'rest',
      templateSnapshot: session.templateSnapshot,
      currentStepIndex,
      startedAt: session.startedAt ?? now,
      restEndsAt: now + step.restPreset.durationSeconds * 1_000,
    }
  }

  return {
    status: 'exercise',
    templateSnapshot: session.templateSnapshot,
    currentStepIndex,
    startedAt: session.startedAt ?? now,
  }
}

export function startWorkout(
  session: ActiveWorkoutSession,
  now: number,
): OperationResult<ExerciseWorkoutSession | RestWorkoutSession> {
  if (session.status === 'completed') {
    return failure({ code: 'SESSION_COMPLETED' })
  }

  if (session.status !== 'not_started') {
    return failure({ code: 'SESSION_ALREADY_STARTED' })
  }

  return success(activateStep(session, 0, now))
}

const advanceWorkout = (
  session: ExerciseWorkoutSession | RestWorkoutSession,
  now: number,
): ActiveWorkoutSession => {
  const nextStepIndex = session.currentStepIndex + 1

  if (nextStepIndex >= session.templateSnapshot.steps.length) {
    const completed: CompletedWorkoutSession = {
      status: 'completed',
      templateSnapshot: session.templateSnapshot,
      currentStepIndex: session.templateSnapshot.steps.length,
      startedAt: session.startedAt,
      completedAt: now,
    }

    return completed
  }

  return activateStep(session, nextStepIndex, now)
}

export function completeCurrentExercise(
  session: ActiveWorkoutSession,
  now: number,
): OperationResult<ActiveWorkoutSession> {
  if (session.status === 'completed') {
    return failure({ code: 'SESSION_COMPLETED' })
  }

  if (session.status === 'not_started') {
    return failure({ code: 'SESSION_NOT_STARTED' })
  }

  if (session.status !== 'exercise') {
    return failure({ code: 'NOT_EXERCISE' })
  }

  return success(advanceWorkout(session, now))
}

export function completeCurrentRest(
  session: ActiveWorkoutSession,
  now: number,
): OperationResult<ActiveWorkoutSession> {
  if (session.status === 'completed') {
    return failure({ code: 'SESSION_COMPLETED' })
  }

  if (session.status === 'not_started') {
    return failure({ code: 'SESSION_NOT_STARTED' })
  }

  if (session.status !== 'rest') {
    return failure({ code: 'NOT_REST' })
  }

  return success(advanceWorkout(session, now))
}

export function getCurrentStep(
  session: ActiveWorkoutSession,
): WorkoutStep | undefined {
  if (session.status === 'not_started' || session.status === 'completed') {
    return undefined
  }

  return session.templateSnapshot.steps[session.currentStepIndex]
}

export function getNextStep(
  session: ActiveWorkoutSession,
): WorkoutStep | undefined {
  if (session.status === 'completed') {
    return undefined
  }

  const nextStepIndex =
    session.status === 'not_started' ? 0 : session.currentStepIndex + 1

  return session.templateSnapshot.steps[nextStepIndex]
}

export function isWorkoutCompleted(
  session: ActiveWorkoutSession,
): session is CompletedWorkoutSession {
  return session.status === 'completed'
}
