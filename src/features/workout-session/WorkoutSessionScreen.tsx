import { NumericValueCard } from '../../shared/NumericValueCard'
import { parseWorkingReps } from '../../domain/working-reps'
import { RestTimer } from './RestTimer'
import {
  parseWorkingWeight,
  formatWorkingWeight,
} from '../../domain/working-weight'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  completeCurrentExercise,
  completeCurrentRest,
  extendCurrentRest,
  getCurrentStep,
  getNextExercise,
  getSetProgress,
  setSessionExerciseWeight,
  setSessionExerciseReps,
  getWorkingSetProgress,
  isRestFinished,
  type ActiveWorkoutSession,
} from '../../domain/workout-session'
import { RepositoryErrorAlert } from '../../shared/catalog-ui'
import type { ActiveWorkoutSessionRepository } from './active-workout-session-repository'
import {
  workoutAudioService,
  type WorkoutAudioService,
} from '../../shared/audio/workout-audio-service'
import {
  workoutVibrationService,
  type WorkoutVibrationService,
} from '../../shared/vibration/workout-vibration-service'
import {
  workoutFeedbackSettingsStore,
  type WorkoutFeedbackSettingsStore,
} from '../workout-feedback/workout-feedback-settings'
import {
  restFeedbackDeduplicator,
  type RestFeedbackDeduplicator,
} from '../workout-feedback/rest-feedback-deduplicator'

interface WorkoutSessionScreenProps {
  readonly repository: ActiveWorkoutSessionRepository
  readonly navigate: (path: string) => void
  readonly now?: () => number
  readonly audioService?: WorkoutAudioService
  readonly vibrationService?: WorkoutVibrationService
  readonly feedbackSettingsStore?: WorkoutFeedbackSettingsStore
  readonly feedbackDeduplicator?: RestFeedbackDeduplicator
}

export const RESTORED_REST_FEEDBACK_MAX_LATENESS_MS = 5_000

export function WorkoutSessionScreen({
  repository,
  navigate,
  now = Date.now,
  audioService = workoutAudioService,
  vibrationService = workoutVibrationService,
  feedbackSettingsStore = workoutFeedbackSettingsStore,
  feedbackDeduplicator = restFeedbackDeduplicator,
}: WorkoutSessionScreenProps) {
  const [editingField, setEditingField] = useState<'weight' | 'reps' | null>(
    null,
  )
  const [session, setSession] = useState<ActiveWorkoutSession>()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showExitConfirmation, setShowExitConfirmation] = useState(false)
  const [error, setError] = useState<string>()
  const [restCompletionFailed, setRestCompletionFailed] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => now())
  const transitionInFlight = useRef(false)
  const mountedAt = useRef(now())
  const activeRestEndsAt =
    session?.status === 'rest' ? session.restEndsAt : undefined

  const reportError = useCallback((cause: unknown, message: string) => {
    console.error('Active workout session repository operation failed.', cause)
    setError(message)
  }, [])

  useEffect(() => {
    let active = true
    void repository
      .get()
      .then((stored) => {
        if (!active) return
        setSession(stored)
        if (!stored) setError('Активная тренировка не найдена.')
      })
      .catch((cause: unknown) => {
        if (active)
          reportError(
            cause,
            'Не удалось загрузить активную тренировку. Попробуйте ещё раз.',
          )
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [reportError, repository])

  const persistTransition = useCallback(
    async (
      sourceSession: ActiveWorkoutSession,
      transition: 'exercise' | 'rest',
    ) => {
      if (transitionInFlight.current) return
      if (
        sourceSession.status === 'not_started' ||
        sourceSession.status === 'completed'
      )
        return

      transitionInFlight.current = true
      const transitionTime = now()
      const result =
        transition === 'exercise'
          ? completeCurrentExercise(sourceSession, transitionTime)
          : completeCurrentRest(sourceSession, transitionTime)

      if (!result.success) {
        reportError(result.error, 'Не удалось перейти к следующему шагу.')
        transitionInFlight.current = false
        return
      }

      setIsSaving(true)
      setError(undefined)
      setRestCompletionFailed(false)
      try {
        if (result.value.status === 'completed') {
          await repository.complete(result.value)
        } else {
          await repository.update(result.value)
        }
        setSession(result.value)
        setCurrentTime(transitionTime)
      } catch (cause) {
        if (transition === 'rest') setRestCompletionFailed(true)
        reportError(
          cause,
          transition === 'rest'
            ? 'Не удалось завершить отдых. Текущий шаг не изменён.'
            : 'Не удалось сохранить прогресс. Текущий шаг не изменён.',
        )
      } finally {
        setIsSaving(false)
        transitionInFlight.current = false
      }
    },
    [now, reportError, repository],
  )

  const advance = () => {
    if (
      !session ||
      session.status === 'not_started' ||
      session.status === 'completed'
    )
      return
    void persistTransition(session, session.status)
  }

  const tryRestFinishedFeedback = useCallback(
    (
      sourceSession: Extract<ActiveWorkoutSession, { status: 'rest' }>,
      detectedAt: number,
    ) => {
      const lateness = detectedAt - sourceSession.restEndsAt
      if (lateness > RESTORED_REST_FEEDBACK_MAX_LATENESS_MS) return
      const key = `${sourceSession.templateSnapshot.id}:${sourceSession.startedAt}:${sourceSession.currentStepIndex}:${sourceSession.restEndsAt}`
      if (!feedbackDeduplicator.markOnce(key)) return

      const settings = feedbackSettingsStore.load()
      if (settings.soundEnabled) {
        void audioService.playRestFinishedSignal().then((result) => {
          if (!result.success)
            console.warn('Rest-finished sound was unavailable.', result.error)
        })
      }
      if (settings.vibrationEnabled && !vibrationService.vibrateRestFinished())
        console.info('Rest-finished vibration was unavailable.')
    },
    [
      audioService,
      feedbackDeduplicator,
      feedbackSettingsStore,
      vibrationService,
    ],
  )

  useEffect(() => {
    if (session?.status !== 'rest' || transitionInFlight.current) return

    const synchronize = () => setCurrentTime(now())
    synchronize()
    const intervalId = window.setInterval(synchronize, 1_000)
    document.addEventListener('visibilitychange', synchronize)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', synchronize)
    }
  }, [activeRestEndsAt, now, session?.status])

  useEffect(() => {
    if (
      session?.status === 'rest' &&
      isRestFinished(session.restEndsAt, currentTime) &&
      !restCompletionFailed &&
      !transitionInFlight.current
    ) {
      const detectedAt = currentTime
      // A restored deadline is only announced when it is still fresh. A live timer
      // uses the same path and key, so Strict Mode and retries cannot repeat it.
      if (
        detectedAt >= mountedAt.current ||
        detectedAt - session.restEndsAt <=
          RESTORED_REST_FEEDBACK_MAX_LATENESS_MS
      )
        tryRestFinishedFeedback(session, detectedAt)
      void persistTransition(session, 'rest')
    }
  }, [
    currentTime,
    persistTransition,
    restCompletionFailed,
    session,
    tryRestFinishedFeedback,
  ])

  const extendRest = async () => {
    if (session?.status !== 'rest' || transitionInFlight.current) return

    transitionInFlight.current = true
    const result = extendCurrentRest(session, 30)
    if (!result.success) {
      reportError(result.error, 'Не удалось увеличить время отдыха.')
      transitionInFlight.current = false
      return
    }

    setIsSaving(true)
    setError(undefined)
    try {
      await repository.update(result.value)
      setSession(result.value)
      setCurrentTime(now())
    } catch (cause) {
      reportError(
        cause,
        'Не удалось увеличить время отдыха. Попробуйте ещё раз.',
      )
    } finally {
      setIsSaving(false)
      transitionInFlight.current = false
    }
  }

  const saveValue = async (field: 'weight' | 'reps', value: number | null) => {
    if (!session || transitionInFlight.current) throw new Error('Session busy')
    const step = getCurrentStep(session)
    if (step?.type !== 'exercise') throw new Error('No exercise')
    transitionInFlight.current = true
    setIsSaving(true)
    try {
      if (field === 'weight') {
        await repository.updateExerciseWeight(session, step.exercise.id, value)
        setSession(setSessionExerciseWeight(session, step.exercise.id, value))
      } else {
        await repository.updateExerciseReps(session, step.exercise.id, value)
        setSession(setSessionExerciseReps(session, step.exercise.id, value))
      }
    } finally {
      transitionInFlight.current = false
      setIsSaving(false)
    }
  }

  const finishAndLeave = async () => {
    setIsSaving(true)
    try {
      await repository.clear()
      navigate('/workouts')
    } catch (cause) {
      reportError(cause, 'Не удалось завершить тренировку. Попробуйте ещё раз.')
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-dvh bg-slate-950 p-6 text-center text-slate-400">
        Загрузка…
      </main>
    )
  }

  if (!session) {
    return (
      <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-xl">
          {error ? <RepositoryErrorAlert message={error} /> : null}
          <button
            type="button"
            className="mt-6 min-h-11 text-lime-300"
            onClick={() => navigate('/workouts')}
          >
            Вернуться к тренировкам
          </button>
        </div>
      </main>
    )
  }

  const progress = getWorkingSetProgress(session)
  const currentStep = getCurrentStep(session)
  const nextStep = getNextExercise(session)

  return (
    <main className="session-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-lime-300 uppercase">
              Workout Flow
            </p>
            <h1 className="mt-2 text-xl font-bold">
              {session.templateSnapshot.name}
            </h1>
          </div>
          {session.status !== 'completed' ? (
            <button
              type="button"
              className="min-h-11 px-2 text-sm text-slate-300"
              onClick={() => setShowExitConfirmation(true)}
            >
              Выйти
            </button>
          ) : null}
        </header>

        {error ? <RepositoryErrorAlert message={error} /> : null}

        {showExitConfirmation ? (
          <section
            role="alertdialog"
            aria-labelledby="exit-title"
            className="mt-6 rounded-2xl border border-red-900 bg-red-950/40 p-5"
          >
            <h2 id="exit-title" className="font-semibold">
              Завершить текущую тренировку?
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isSaving}
                className="min-h-11 rounded-xl border border-slate-700 px-4"
                onClick={() => setShowExitConfirmation(false)}
              >
                Продолжить тренировку
              </button>
              <button
                type="button"
                disabled={isSaving}
                className="min-h-11 rounded-xl bg-red-500 px-4 font-semibold"
                onClick={() => void finishAndLeave()}
              >
                Завершить тренировку
              </button>
            </div>
          </section>
        ) : null}

        {session.status === 'completed' ? (
          <section className="mt-10 rounded-3xl border border-lime-900 bg-slate-900 p-6 text-center">
            <p className="text-3xl" aria-hidden="true">
              ✓
            </p>
            <h2 className="mt-3 text-2xl font-bold">Тренировка завершена</h2>
            <p className="mt-3 text-lg">{session.templateSnapshot.name}</p>
            <p className="mt-2 text-slate-400">
              Выполнено подходов: {progress.total}
            </p>
            <button
              type="button"
              disabled={isSaving}
              className="mt-8 min-h-14 w-full rounded-2xl bg-lime-300 px-5 text-lg font-bold text-slate-950"
              onClick={() => void finishAndLeave()}
            >
              Вернуться к тренировкам
            </button>
          </section>
        ) : currentStep ? (
          <section className="mt-6">
            <p className="text-sm font-semibold text-slate-400">
              {currentStep.type === 'exercise'
                ? `Рабочий подход ${progress.current} из ${progress.total}`
                : `Выполнено ${progress.completed} из ${progress.total} подходов`}
            </p>
            <progress
              className="workout-progress"
              aria-label="Выполнено подходов"
              max={Math.max(1, progress.total)}
              value={progress.completed}
            />
            <p className="mt-5 text-sm font-semibold tracking-wide text-lime-300 uppercase">
              {currentStep.type === 'exercise' ? 'Упражнение' : 'Отдых'}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {currentStep.type === 'exercise'
                ? currentStep.exercise.name
                : currentStep.restPreset.name}
            </h2>
            {currentStep.type === 'rest' && session.status === 'rest' ? (
              <RestTimer session={session} now={currentTime} />
            ) : null}
            {currentStep.type === 'exercise' ? (
              <>
                <p className="mt-4 text-lg">
                  Подход {getSetProgress(currentStep).number} из{' '}
                  {getSetProgress(currentStep).total}
                </p>
                {getSetProgress(currentStep).isLast ? (
                  <p className="last-set-badge">Последний подход</p>
                ) : null}
                <div className="value-grid">
                  <NumericValueCard
                    label="Рабочий вес"
                    value={currentStep.exercise.lastWeightKg}
                    formattedValue={formatWorkingWeight(
                      currentStep.exercise.lastWeightKg,
                    )}
                    editLabel="Изменить вес"
                    inputLabel="Вес, кг"
                    saveLabel="Сохранить вес"
                    inputMode="decimal"
                    editing={editingField === 'weight'}
                    disabled={
                      isSaving ||
                      (editingField !== null && editingField !== 'weight')
                    }
                    parse={parseWorkingWeight}
                    onEditingChange={(editing) =>
                      setEditingField(editing ? 'weight' : null)
                    }
                    onSave={(value) => saveValue('weight', value)}
                    saveError="Не удалось сохранить вес. Попробуйте ещё раз."
                  />
                  <NumericValueCard
                    label="Повторения"
                    value={currentStep.exercise.lastReps}
                    formattedValue={
                      currentStep.exercise.lastReps?.toString() ?? 'Не указаны'
                    }
                    editLabel="Изменить повторения"
                    inputLabel="Количество повторений"
                    saveLabel="Сохранить повторения"
                    inputMode="numeric"
                    editing={editingField === 'reps'}
                    disabled={
                      isSaving ||
                      (editingField !== null && editingField !== 'reps')
                    }
                    parse={parseWorkingReps}
                    onEditingChange={(editing) =>
                      setEditingField(editing ? 'reps' : null)
                    }
                    onSave={(value) => saveValue('reps', value)}
                    saveError="Не удалось сохранить повторения. Попробуйте ещё раз."
                  />
                </div>
              </>
            ) : null}
            {currentStep.type === 'rest' ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  className="min-h-14 rounded-2xl border border-slate-700 px-5 text-lg font-semibold disabled:opacity-50"
                  onClick={() => void extendRest()}
                >
                  +30 секунд
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  aria-label={restCompletionFailed ? 'Повторить' : 'Пропустить отдых'}
                  className="min-h-14 rounded-2xl bg-lime-300 px-5 text-lg font-bold text-slate-950 disabled:opacity-50"
                  onClick={advance}
                >
                  {isSaving
                    ? 'Сохранение…'
                    : restCompletionFailed
                      ? 'Повторить'
                      : 'Пропустить'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isSaving || editingField !== null}
                className="mt-5 min-h-16 w-full rounded-2xl bg-lime-300 px-6 text-xl font-bold text-slate-950 disabled:opacity-50"
                onClick={advance}
              >
                {isSaving ? 'Сохранение…' : 'Выполнено'}
              </button>
            )}
            <aside
              className="mt-5 rounded-3xl border border-slate-800 bg-slate-900 p-4"
              aria-label="Следующее упражнение"
            >
              {nextStep ? (
                <>
                  <p className="text-sm text-slate-400">Далее</p>
                  <p className="mt-1 font-semibold">{nextStep.exercise.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Подход {getSetProgress(nextStep).number} из{' '}
                    {getSetProgress(nextStep).total}
                  </p>
                </>
              ) : (
                <p>Последнее упражнение тренировки</p>
              )}
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  )
}
