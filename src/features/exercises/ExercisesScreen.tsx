import { useCallback, useEffect, useState, type FormEvent } from 'react'

import type { Exercise } from '../../domain/workout-session'
import {
  EXERCISE_DESCRIPTION_MAX_LENGTH,
  EXERCISE_NAME_MAX_LENGTH,
  validateExerciseForm,
  type ExerciseFormErrors,
  type ExerciseFormValues,
} from './exercise-form'
import type { ExerciseRepository } from './exercise-repository'

interface ExercisesScreenProps {
  readonly repository: ExerciseRepository
}

type FormMode =
  | { readonly type: 'create' }
  | { readonly type: 'edit'; readonly exercise: Exercise }

const emptyForm: ExerciseFormValues = { name: '', description: '' }

export function ExercisesScreen({ repository }: ExercisesScreenProps) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [formValues, setFormValues] = useState<ExerciseFormValues>(emptyForm)
  const [formErrors, setFormErrors] = useState<ExerciseFormErrors>({})
  const [exerciseToRemove, setExerciseToRemove] = useState<Exercise | null>(
    null,
  )
  const [repositoryError, setRepositoryError] = useState<string | null>(null)

  const showRepositoryError = useCallback((error: unknown, message: string) => {
    console.error('Exercise repository operation failed.', error)
    setRepositoryError(message)
  }, [])

  const loadExercises = useCallback(async () => {
    try {
      const storedExercises = await repository.getAll()
      setExercises(storedExercises)
      setRepositoryError(null)
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось загрузить упражнения. Попробуйте ещё раз.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [repository, showRepositoryError])

  useEffect(() => {
    let isActive = true

    void repository
      .getAll()
      .then((storedExercises) => {
        if (isActive) {
          setExercises(storedExercises)
          setRepositoryError(null)
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          showRepositoryError(
            error,
            'Не удалось загрузить упражнения. Попробуйте ещё раз.',
          )
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [repository, showRepositoryError])

  const openCreateForm = () => {
    setFormMode({ type: 'create' })
    setFormValues(emptyForm)
    setFormErrors({})
    setRepositoryError(null)
  }

  const openEditForm = (exercise: Exercise) => {
    setFormMode({ type: 'edit', exercise })
    setFormValues({
      name: exercise.name,
      description: exercise.description ?? '',
    })
    setFormErrors({})
    setRepositoryError(null)
  }

  const closeForm = () => {
    setFormMode(null)
    setFormValues(emptyForm)
    setFormErrors({})
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateExerciseForm(formValues)

    if (!validation.success) {
      setFormErrors(validation.errors)
      return
    }

    setIsSaving(true)
    setFormErrors({})
    setRepositoryError(null)

    try {
      if (formMode?.type === 'edit') {
        await repository.update(formMode.exercise.id, validation.value)
      } else {
        await repository.create(validation.value)
      }

      closeForm()
      await loadExercises()
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось сохранить изменения. Попробуйте ещё раз.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!exerciseToRemove) {
      return
    }

    setIsSaving(true)
    setRepositoryError(null)

    try {
      await repository.remove(exerciseToRemove.id)
      setExerciseToRemove(null)
      await loadExercises()
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось удалить упражнение. Попробуйте ещё раз.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-lime-300 uppercase">
              Workout Flow
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Упражнения
            </h1>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="min-h-11 shrink-0 rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
          >
            Добавить упражнение
          </button>
        </header>

        {repositoryError ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200"
          >
            {repositoryError}
          </div>
        ) : null}

        {formMode ? (
          <section
            aria-labelledby="exercise-form-title"
            className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
          >
            <h2 id="exercise-form-title" className="text-xl font-semibold">
              {formMode.type === 'create'
                ? 'Новое упражнение'
                : 'Изменить упражнение'}
            </h2>

            <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="exercise-name" className="text-sm font-medium">
                  Название
                </label>
                <input
                  id="exercise-name"
                  name="name"
                  autoFocus
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  maxLength={EXERCISE_NAME_MAX_LENGTH}
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={
                    formErrors.name ? 'exercise-name-error' : undefined
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base outline-none focus:border-lime-300"
                />
                {formErrors.name ? (
                  <p
                    id="exercise-name-error"
                    className="mt-2 text-sm text-red-300"
                  >
                    {formErrors.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="exercise-description"
                  className="text-sm font-medium"
                >
                  Описание
                </label>
                <textarea
                  id="exercise-description"
                  name="description"
                  rows={4}
                  value={formValues.description}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  maxLength={EXERCISE_DESCRIPTION_MAX_LENGTH}
                  aria-invalid={Boolean(formErrors.description)}
                  aria-describedby={
                    formErrors.description
                      ? 'exercise-description-error'
                      : undefined
                  }
                  className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base outline-none focus:border-lime-300"
                />
                {formErrors.description ? (
                  <p
                    id="exercise-description-error"
                    className="mt-2 text-sm text-red-300"
                  >
                    {formErrors.description}
                  </p>
                ) : null}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-11 rounded-xl bg-lime-300 px-5 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="min-h-11 rounded-xl border border-slate-700 px-5 py-2 font-medium text-slate-200 disabled:opacity-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section aria-label="Список упражнений" className="mt-6">
          {isLoading ? (
            <p className="py-12 text-center text-slate-400">Загрузка…</p>
          ) : exercises.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center">
              <h2 className="text-lg font-semibold">Упражнений пока нет</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Добавьте первое упражнение, чтобы позже собрать тренировку.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {exercises.map((exercise) => (
                <li
                  key={exercise.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
                >
                  <h2 className="text-lg font-semibold">{exercise.name}</h2>
                  {exercise.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                      {exercise.description}
                    </p>
                  ) : null}

                  {exerciseToRemove?.id === exercise.id ? (
                    <div
                      role="alertdialog"
                      aria-labelledby={`remove-title-${exercise.id}`}
                      className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4"
                    >
                      <p
                        id={`remove-title-${exercise.id}`}
                        className="text-sm text-red-100"
                      >
                        Удалить упражнение «{exercise.name}»?
                      </p>
                      <div className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => void handleRemove()}
                          disabled={isSaving}
                          className="min-h-11 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          onClick={() => setExerciseToRemove(null)}
                          disabled={isSaving}
                          className="min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-4">
                      <button
                        type="button"
                        onClick={() => openEditForm(exercise)}
                        className="min-h-11 text-sm font-semibold text-lime-300"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => setExerciseToRemove(exercise)}
                        className="min-h-11 text-sm font-semibold text-red-300"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
