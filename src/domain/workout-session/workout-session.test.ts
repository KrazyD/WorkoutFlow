import { describe, expect, it } from 'vitest'

import {
  completeCurrentExercise,
  completeCurrentRest,
  createActiveWorkoutSession,
  getCurrentStep,
  getNextStep,
  isWorkoutCompleted,
  startWorkout,
  type Exercise,
  type OperationResult,
  type RestPreset,
  type WorkoutTemplate,
} from './index'

const pushUp: Exercise = {
  id: 'exercise-push-up',
  name: 'Push-up',
  description: 'Keep the body straight.',
}

const squat: Exercise = {
  id: 'exercise-squat',
  name: 'Squat',
}

const shortRest: RestPreset = {
  id: 'rest-short',
  name: 'Short rest',
  durationSeconds: 30,
}

const exerciseStep = (exercise: Exercise) =>
  ({ type: 'exercise', exercise }) as const

const restStep = (restPreset: RestPreset) =>
  ({ type: 'rest', restPreset }) as const

const template = (steps: WorkoutTemplate['steps']): WorkoutTemplate => ({
  id: 'template-main',
  name: 'Main workout',
  steps,
})

function expectSuccess<T>(result: OperationResult<T>): T {
  expect(result.success).toBe(true)

  if (!result.success) {
    throw new Error(`Expected success, received ${result.error.code}`)
  }

  return result.value
}

describe('workout session', () => {
  it('starts with the first exercise', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(template([exerciseStep(pushUp)])),
    )
    const started = expectSuccess(startWorkout(session, 1_000))

    expect(started).toMatchObject({
      status: 'exercise',
      currentStepIndex: 0,
      startedAt: 1_000,
    })
    expect(getCurrentStep(started)).toEqual(exerciseStep(pushUp))
    expect(getNextStep(started)).toBeUndefined()
  })

  it('opens the next step after completing an exercise', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(
        template([exerciseStep(pushUp), exerciseStep(squat)]),
      ),
    )
    const started = expectSuccess(startWorkout(session, 1_000))
    const advanced = expectSuccess(completeCurrentExercise(started, 2_000))

    expect(advanced).toMatchObject({
      status: 'exercise',
      currentStepIndex: 1,
    })
    expect(getCurrentStep(advanced)).toEqual(exerciseStep(squat))
  })

  it('calculates restEndsAt when an exercise advances to rest', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(
        template([exerciseStep(pushUp), restStep(shortRest)]),
      ),
    )
    const started = expectSuccess(startWorkout(session, 1_000))
    const resting = expectSuccess(completeCurrentExercise(started, 5_000))

    expect(resting).toMatchObject({
      status: 'rest',
      currentStepIndex: 1,
      restEndsAt: 35_000,
    })
  })

  it('opens the next exercise after completing rest', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(
        template([restStep(shortRest), exerciseStep(squat)]),
      ),
    )
    const resting = expectSuccess(startWorkout(session, 1_000))
    const exercising = expectSuccess(completeCurrentRest(resting, 31_000))

    expect(exercising).toMatchObject({
      status: 'exercise',
      currentStepIndex: 1,
    })
    expect(getCurrentStep(exercising)).toEqual(exerciseStep(squat))
  })

  it('completes after the final exercise', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(template([exerciseStep(pushUp)])),
    )
    const started = expectSuccess(startWorkout(session, 1_000))
    const completed = expectSuccess(completeCurrentExercise(started, 2_000))

    expect(completed).toMatchObject({
      status: 'completed',
      currentStepIndex: 1,
    })
    expect(getCurrentStep(completed)).toBeUndefined()
    expect(getNextStep(completed)).toBeUndefined()
    expect(isWorkoutCompleted(completed)).toBe(true)
  })

  it('can start with rest', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(
        template([restStep(shortRest), exerciseStep(pushUp)]),
      ),
    )
    const started = expectSuccess(startWorkout(session, 10_000))

    expect(started).toMatchObject({
      status: 'rest',
      currentStepIndex: 0,
      restEndsAt: 40_000,
    })
  })

  it('can end with rest', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(
        template([exerciseStep(pushUp), restStep(shortRest)]),
      ),
    )
    const started = expectSuccess(startWorkout(session, 1_000))
    const resting = expectSuccess(completeCurrentExercise(started, 2_000))
    const completed = expectSuccess(completeCurrentRest(resting, 32_000))

    expect(completed.status).toBe('completed')
    expect(isWorkoutCompleted(completed)).toBe(true)
  })

  it('rejects an empty workout template', () => {
    const result = createActiveWorkoutSession(template([]))

    expect(result).toEqual({
      success: false,
      error: { code: 'EMPTY_TEMPLATE' },
    })
  })

  it('rejects exercise completion during rest', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(template([restStep(shortRest)])),
    )
    const resting = expectSuccess(startWorkout(session, 1_000))

    expect(completeCurrentExercise(resting, 2_000)).toEqual({
      success: false,
      error: { code: 'NOT_EXERCISE' },
    })
  })

  it('rejects rest completion during exercise', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(template([exerciseStep(pushUp)])),
    )
    const exercising = expectSuccess(startWorkout(session, 1_000))

    expect(completeCurrentRest(exercising, 2_000)).toEqual({
      success: false,
      error: { code: 'NOT_REST' },
    })
  })

  it('rejects rest completion before its end time', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(template([restStep(shortRest)])),
    )
    const resting = expectSuccess(startWorkout(session, 1_000))

    expect(completeCurrentRest(resting, 30_999)).toEqual({
      success: false,
      error: {
        code: 'REST_NOT_FINISHED',
        restEndsAt: 31_000,
      },
    })
  })

  it('returns an explicit error for operations after completion', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(template([exerciseStep(pushUp)])),
    )
    const started = expectSuccess(startWorkout(session, 1_000))
    const completed = expectSuccess(completeCurrentExercise(started, 2_000))

    expect(completeCurrentExercise(completed, 3_000)).toEqual({
      success: false,
      error: { code: 'SESSION_COMPLETED' },
    })
    expect(completeCurrentRest(completed, 3_000)).toEqual({
      success: false,
      error: { code: 'SESSION_COMPLETED' },
    })
    expect(completed.status).toBe('completed')
  })

  it('exposes the next step without advancing the session', () => {
    const session = expectSuccess(
      createActiveWorkoutSession(
        template([exerciseStep(pushUp), restStep(shortRest)]),
      ),
    )
    const started = expectSuccess(startWorkout(session, 1_000))

    expect(getNextStep(started)).toEqual(restStep(shortRest))
    expect(getCurrentStep(started)).toEqual(exerciseStep(pushUp))
  })

  it('keeps a snapshot that is independent from later template edits', () => {
    const sourceExercise = {
      id: 'exercise-source',
      name: 'Source exercise',
    }
    const sourceSteps = [exerciseStep(sourceExercise)]
    const source = {
      id: 'template-source',
      name: 'Source workout',
      steps: sourceSteps,
    }
    const session = expectSuccess(createActiveWorkoutSession(source))

    source.name = 'Changed workout'
    sourceSteps[0] = exerciseStep(squat)
    sourceExercise.name = 'Changed exercise'

    expect(session.templateSnapshot.name).toBe('Source workout')
    expect(session.templateSnapshot.steps[0]).toEqual(
      exerciseStep({
        id: 'exercise-source',
        name: 'Source exercise',
      }),
    )
  })
})
