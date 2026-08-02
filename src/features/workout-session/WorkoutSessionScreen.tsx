import { useCallback, useEffect, useState } from 'react'

import {
  completeCurrentExercise,
  completeCurrentRest,
  getCurrentStep,
  getNextStep,
  type ActiveWorkoutSession,
  type WorkoutStep,
} from '../../domain/workout-session'
import { RepositoryErrorAlert } from '../../shared/catalog-ui'
import { formatRestDuration } from '../rest-presets/rest-duration'
import type { ActiveWorkoutSessionRepository } from './active-workout-session-repository'

interface WorkoutSessionScreenProps {
  readonly repository: ActiveWorkoutSessionRepository
  readonly navigate: (path: string) => void
  readonly now?: () => number
}

const stepName = (step: WorkoutStep): string =>
  step.type === 'exercise'
    ? step.exercise.name
    : `Отдых — ${formatRestDuration(step.restPreset.durationSeconds)}`

export function WorkoutSessionScreen({
  repository,
  navigate,
  now = Date.now,
}: WorkoutSessionScreenProps) {
  const [session, setSession] = useState<ActiveWorkoutSession>()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showExitConfirmation, setShowExitConfirmation] = useState(false)
  const [error, setError] = useState<string>()

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

  const advance = async () => {
    if (!session || session.status === 'not_started' || session.status === 'completed')
      return

    const result =
      session.status === 'exercise'
        ? completeCurrentExercise(session, now())
        : completeCurrentRest(session, now())

    if (!result.success) {
      reportError(result.error, 'Не удалось перейти к следующему шагу.')
      return
    }

    setIsSaving(true)
    setError(undefined)
    try {
      if (result.value.status === 'completed') {
        await repository.complete(result.value)
      } else {
        await repository.update(result.value)
      }
      setSession(result.value)
    } catch (cause) {
      reportError(
        cause,
        'Не удалось сохранить прогресс. Текущий шаг не изменён.',
      )
    } finally {
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
    return <main className="min-h-dvh bg-slate-950 p-6 text-center text-slate-400">Загрузка…</main>
  }

  if (!session) {
    return (
      <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-xl">
          {error ? <RepositoryErrorAlert message={error} /> : null}
          <button className="mt-6 min-h-11 text-lime-300" onClick={() => navigate('/workouts')}>
            Вернуться к тренировкам
          </button>
        </div>
      </main>
    )
  }

  const totalSteps = session.templateSnapshot.steps.length
  const currentStep = getCurrentStep(session)
  const nextStep = getNextStep(session)

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-lime-300 uppercase">Workout Flow</p>
            <h1 className="mt-2 text-2xl font-bold">{session.templateSnapshot.name}</h1>
          </div>
          {session.status !== 'completed' ? (
            <button type="button" className="min-h-11 px-2 text-sm text-slate-300" onClick={() => setShowExitConfirmation(true)}>
              Выйти
            </button>
          ) : null}
        </header>

        {error ? <RepositoryErrorAlert message={error} /> : null}

        {showExitConfirmation ? (
          <section role="alertdialog" aria-labelledby="exit-title" className="mt-6 rounded-2xl border border-red-900 bg-red-950/40 p-5">
            <h2 id="exit-title" className="font-semibold">Завершить текущую тренировку?</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" disabled={isSaving} className="min-h-11 rounded-xl border border-slate-700 px-4" onClick={() => setShowExitConfirmation(false)}>Продолжить тренировку</button>
              <button type="button" disabled={isSaving} className="min-h-11 rounded-xl bg-red-500 px-4 font-semibold" onClick={() => void finishAndLeave()}>Завершить тренировку</button>
            </div>
          </section>
        ) : null}

        {session.status === 'completed' ? (
          <section className="mt-10 rounded-3xl border border-lime-900 bg-slate-900 p-6 text-center">
            <p className="text-3xl" aria-hidden="true">✓</p>
            <h2 className="mt-3 text-2xl font-bold">Тренировка завершена</h2>
            <p className="mt-3 text-lg">{session.templateSnapshot.name}</p>
            <p className="mt-2 text-slate-400">Выполнено шагов: {totalSteps}</p>
            <button type="button" disabled={isSaving} className="mt-8 min-h-14 w-full rounded-2xl bg-lime-300 px-5 text-lg font-bold text-slate-950" onClick={() => void finishAndLeave()}>
              Вернуться к тренировкам
            </button>
          </section>
        ) : currentStep ? (
          <section className="mt-10">
            <p className="text-sm font-semibold text-slate-400">Шаг {session.currentStepIndex + 1} из {totalSteps}</p>
            <p className="mt-6 text-sm font-semibold tracking-wide text-lime-300 uppercase">
              {currentStep.type === 'exercise' ? 'Упражнение' : 'Отдых'}
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">
              {currentStep.type === 'exercise' ? currentStep.exercise.name : currentStep.restPreset.name}
            </h2>
            {currentStep.type === 'rest' ? (
              <p className="mt-3 text-2xl text-slate-200">{formatRestDuration(currentStep.restPreset.durationSeconds)}</p>
            ) : null}
            {nextStep ? (
              <div className="mt-10 rounded-2xl bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Далее:</p>
                <p className="mt-1 font-semibold">{stepName(nextStep)}</p>
              </div>
            ) : null}
            <button type="button" disabled={isSaving} className="mt-8 min-h-16 w-full rounded-2xl bg-lime-300 px-6 text-xl font-bold text-slate-950 disabled:opacity-50" onClick={() => void advance()}>
              {isSaving ? 'Сохранение…' : currentStep.type === 'exercise' ? 'Выполнено' : 'Завершить отдых'}
            </button>
          </section>
        ) : null}
      </div>
    </main>
  )
}
