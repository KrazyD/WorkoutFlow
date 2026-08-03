import { useCallback, useEffect, useState, type FormEvent } from 'react'

import type { RestPreset } from '../../domain/workout-session'
import {
  CatalogEmptyState,
  CatalogPageLayout,
  DeleteConfirmation,
  RepositoryErrorAlert,
} from '../../shared/catalog-ui'
import {
  REST_MINUTES_MAX,
  REST_PRESET_NAME_MAX_LENGTH,
  REST_SECONDS_MAX,
  validateRestPresetForm,
  type RestPresetFormErrors,
  type RestPresetFormValues,
} from './rest-preset-form'
import type { RestPresetRepository } from './rest-preset-repository'
import { formatRestDuration, fromDurationSeconds } from './rest-duration'

interface RestPresetsScreenProps {
  readonly repository: RestPresetRepository
}

type FormMode =
  | { readonly type: 'create' }
  | { readonly type: 'edit'; readonly restPreset: RestPreset }

const emptyForm: RestPresetFormValues = {
  name: '',
  minutes: '1',
  seconds: '0',
}

export function RestPresetsScreen({ repository }: RestPresetsScreenProps) {
  const [restPresets, setRestPresets] = useState<RestPreset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [formValues, setFormValues] = useState<RestPresetFormValues>(emptyForm)
  const [formErrors, setFormErrors] = useState<RestPresetFormErrors>({})
  const [restPresetToRemove, setRestPresetToRemove] =
    useState<RestPreset | null>(null)
  const [repositoryError, setRepositoryError] = useState<string | null>(null)

  const showRepositoryError = useCallback((error: unknown, message: string) => {
    console.error('Rest preset repository operation failed.', error)
    setRepositoryError(message)
  }, [])

  const loadRestPresets = useCallback(async () => {
    try {
      const storedRestPresets = await repository.getAll()
      setRestPresets(storedRestPresets)
      setRepositoryError(null)
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось загрузить варианты отдыха. Попробуйте ещё раз.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [repository, showRepositoryError])

  useEffect(() => {
    let isActive = true

    void repository
      .getAll()
      .then((storedRestPresets) => {
        if (isActive) {
          setRestPresets(storedRestPresets)
          setRepositoryError(null)
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          showRepositoryError(
            error,
            'Не удалось загрузить варианты отдыха. Попробуйте ещё раз.',
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

  const openEditForm = (restPreset: RestPreset) => {
    const duration = fromDurationSeconds(restPreset.durationSeconds)

    setFormMode({ type: 'edit', restPreset })
    setFormValues({
      name: restPreset.name,
      minutes: String(duration.minutes),
      seconds: String(duration.seconds),
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
    const validation = validateRestPresetForm(formValues)

    if (!validation.success) {
      setFormErrors(validation.errors)
      return
    }

    setIsSaving(true)
    setFormErrors({})
    setRepositoryError(null)

    try {
      if (formMode?.type === 'edit') {
        await repository.update(formMode.restPreset.id, validation.value)
      } else {
        await repository.create(validation.value)
      }

      closeForm()
      await loadRestPresets()
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
    if (!restPresetToRemove) {
      return
    }

    setIsSaving(true)
    setRepositoryError(null)

    try {
      await repository.remove(restPresetToRemove.id)
      setRestPresetToRemove(null)
      await loadRestPresets()
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось удалить вариант отдыха. Попробуйте ещё раз.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <CatalogPageLayout
      title="Отдых"
      actionLabel="Добавить вариант"
      onAction={openCreateForm}
    >
      {repositoryError ? (
        <RepositoryErrorAlert message={repositoryError} />
      ) : null}

      {formMode ? (
        <section
          aria-labelledby="rest-preset-form-title"
          className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
        >
          <h2 id="rest-preset-form-title" className="text-xl font-semibold">
            {formMode.type === 'create'
              ? 'Новый вариант отдыха'
              : 'Изменить вариант отдыха'}
          </h2>

          <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="rest-preset-name" className="text-sm font-medium">
                Название
              </label>
              <input
                id="rest-preset-name"
                name="name"
                autoFocus
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                maxLength={REST_PRESET_NAME_MAX_LENGTH}
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={
                  formErrors.name ? 'rest-preset-name-error' : undefined
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base outline-none focus:border-lime-300"
              />
              {formErrors.name ? (
                <p
                  id="rest-preset-name-error"
                  className="mt-2 text-sm text-red-300"
                >
                  {formErrors.name}
                </p>
              ) : null}
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Продолжительность</legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rest-preset-minutes"
                    className="text-sm text-slate-300"
                  >
                    Минуты
                  </label>
                  <input
                    id="rest-preset-minutes"
                    name="minutes"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={REST_MINUTES_MAX}
                    step="1"
                    value={formValues.minutes}
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        minutes: event.target.value,
                      }))
                    }
                    aria-invalid={Boolean(formErrors.minutes)}
                    aria-describedby={
                      formErrors.minutes
                        ? 'rest-preset-minutes-error'
                        : undefined
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base outline-none focus:border-lime-300"
                  />
                  {formErrors.minutes ? (
                    <p
                      id="rest-preset-minutes-error"
                      className="mt-2 text-sm text-red-300"
                    >
                      {formErrors.minutes}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="rest-preset-seconds"
                    className="text-sm text-slate-300"
                  >
                    Секунды
                  </label>
                  <input
                    id="rest-preset-seconds"
                    name="seconds"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={REST_SECONDS_MAX}
                    step="1"
                    value={formValues.seconds}
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        seconds: event.target.value,
                      }))
                    }
                    aria-invalid={Boolean(formErrors.seconds)}
                    aria-describedby={
                      formErrors.seconds
                        ? 'rest-preset-seconds-error'
                        : undefined
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base outline-none focus:border-lime-300"
                  />
                  {formErrors.seconds ? (
                    <p
                      id="rest-preset-seconds-error"
                      className="mt-2 text-sm text-red-300"
                    >
                      {formErrors.seconds}
                    </p>
                  ) : null}
                </div>
              </div>
              {formErrors.duration ? (
                <p className="mt-3 text-sm text-red-300">
                  {formErrors.duration}
                </p>
              ) : null}
            </fieldset>

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

      <section aria-label="Список вариантов отдыха" className="mt-6">
        {isLoading ? (
          <p className="py-12 text-center text-slate-400">Загрузка…</p>
        ) : restPresets.length === 0 ? (
          <CatalogEmptyState
            title="Вариантов отдыха пока нет"
            description="Добавьте первый вариант, чтобы позже использовать его в тренировке."
          />
        ) : (
          <ul className="space-y-3">
            {restPresets.map((restPreset) => (
              <li
                key={restPreset.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <h2 className="text-lg font-semibold">{restPreset.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {formatRestDuration(restPreset.durationSeconds)}
                </p>

                {restPresetToRemove?.id === restPreset.id ? (
                  <DeleteConfirmation
                    labelId={`remove-rest-preset-${restPreset.id}`}
                    message={`Удалить вариант отдыха «${restPreset.name}»?`}
                    isBusy={isSaving}
                    onConfirm={() => void handleRemove()}
                    onCancel={() => setRestPresetToRemove(null)}
                  />
                ) : (
                  <div className="mt-4 flex gap-4">
                    <button
                      type="button"
                      onClick={() => openEditForm(restPreset)}
                      className="min-h-11 text-sm font-semibold text-lime-300"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestPresetToRemove(restPreset)}
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
    </CatalogPageLayout>
  )
}
