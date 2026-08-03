import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import type {
  WorkoutTemplateRecord,
  WorkoutTemplateStep,
} from '../../domain/workout-template'
import type { Exercise, RestPreset } from '../../domain/workout-session'
import {
  createActiveWorkoutSession,
  startWorkout,
  type ActiveWorkoutSession,
  type WorkoutTemplate,
} from '../../domain/workout-session'
import type { ExerciseRepository } from '../exercises/exercise-repository'
import { formatRestDuration } from '../rest-presets/rest-duration'
import type { RestPresetRepository } from '../rest-presets/rest-preset-repository'
import {
  CatalogEmptyState,
  CatalogPageLayout,
  DeleteConfirmation,
  RepositoryErrorAlert,
} from '../../shared/catalog-ui'
import {
  WORKOUT_TEMPLATE_NAME_MAX_LENGTH,
  validateWorkoutTemplateForm,
  type WorkoutTemplateFormErrors,
  type WorkoutTemplateFormValues,
} from './workout-template-form'
import type { WorkoutTemplateRepository } from './workout-template-repository'
import {
  addStep,
  moveStepDown,
  moveStepUp,
  removeStep,
} from './workout-step-list'
import type { ActiveWorkoutSessionRepository } from '../workout-session/active-workout-session-repository'
import { WorkoutFeedbackSettingsPanel } from '../workout-feedback/WorkoutFeedbackSettingsPanel'
import {
  workoutFeedbackSettingsStore,
  type WorkoutFeedbackSettingsStore,
} from '../workout-feedback/workout-feedback-settings'
import {
  workoutAudioService,
  type WorkoutAudioService,
} from '../../shared/audio/workout-audio-service'
import {
  workoutVibrationService,
  type WorkoutVibrationService,
} from '../../shared/vibration/workout-vibration-service'

interface WorkoutTemplatesScreenProps {
  readonly repository: WorkoutTemplateRepository
  readonly exerciseRepository: ExerciseRepository
  readonly restPresetRepository: RestPresetRepository
  readonly activeWorkoutSessionRepository?: ActiveWorkoutSessionRepository
  readonly navigate?: (path: string) => void
  readonly now?: () => number
  readonly feedbackSettingsStore?: WorkoutFeedbackSettingsStore
  readonly audioService?: WorkoutAudioService
  readonly vibrationService?: WorkoutVibrationService
}

const emptyActiveSessionRepository: ActiveWorkoutSessionRepository = {
  get: async () => undefined,
  save: async () => undefined,
  update: async () => undefined,
  complete: async () => undefined,
  clear: async () => undefined,
}

type FormMode =
  | { readonly type: 'create' }
  | { readonly type: 'edit'; readonly templateId: string }

type Picker = 'exercise' | 'rest' | null

const emptyForm: WorkoutTemplateFormValues = { name: '', steps: [] }

const stepCountLabel = (count: number): string => {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} шагов`
  if (lastDigit === 1) return `${count} шаг`
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} шага`
  return `${count} шагов`
}

export function WorkoutTemplatesScreen({
  repository,
  exerciseRepository,
  restPresetRepository,
  activeWorkoutSessionRepository = emptyActiveSessionRepository,
  navigate = (path) => window.location.assign(path),
  now = Date.now,
  feedbackSettingsStore = workoutFeedbackSettingsStore,
  audioService = workoutAudioService,
  vibrationService = workoutVibrationService,
}: WorkoutTemplatesScreenProps) {
  const [templates, setTemplates] = useState<WorkoutTemplateRecord[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [restPresets, setRestPresets] = useState<RestPreset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [formValues, setFormValues] =
    useState<WorkoutTemplateFormValues>(emptyForm)
  const [formErrors, setFormErrors] = useState<WorkoutTemplateFormErrors>({})
  const [picker, setPicker] = useState<Picker>(null)
  const [templateToRemove, setTemplateToRemove] =
    useState<WorkoutTemplateRecord | null>(null)
  const [repositoryError, setRepositoryError] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveWorkoutSession>()
  const [templateToStart, setTemplateToStart] =
    useState<WorkoutTemplateRecord | null>(null)
  const [feedbackSettings, setFeedbackSettings] = useState(() => feedbackSettingsStore.load())
  const [audioWarning, setAudioWarning] = useState(false)

  const exerciseById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  )
  const restPresetById = useMemo(
    () => new Map(restPresets.map((preset) => [preset.id, preset])),
    [restPresets],
  )

  const showRepositoryError = useCallback((error: unknown, message: string) => {
    console.error('Workout template repository operation failed.', error)
    setRepositoryError(message)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [storedTemplates, storedExercises, storedRestPresets, storedSession] =
        await Promise.all([
          repository.getAll(),
          exerciseRepository.getAll(),
          restPresetRepository.getAll(),
          activeWorkoutSessionRepository.get(),
        ])
      setTemplates(storedTemplates)
      setExercises(storedExercises)
      setRestPresets(storedRestPresets)
      setActiveSession(storedSession)
      setRepositoryError(null)
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось загрузить тренировки. Попробуйте ещё раз.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [
    exerciseRepository,
    repository,
    restPresetRepository, activeWorkoutSessionRepository,
    showRepositoryError,
  ])

  useEffect(() => {
    let isActive = true

    void Promise.all([
      repository.getAll(),
      exerciseRepository.getAll(),
      restPresetRepository.getAll(),
      activeWorkoutSessionRepository.get(),
    ])
      .then(([storedTemplates, storedExercises, storedRestPresets, storedSession]) => {
        if (isActive) {
          setTemplates(storedTemplates)
          setExercises(storedExercises)
          setRestPresets(storedRestPresets)
          setActiveSession(storedSession)
          setRepositoryError(null)
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          showRepositoryError(
            error,
            'Не удалось загрузить тренировки. Попробуйте ещё раз.',
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
  }, [
    exerciseRepository,
    repository,
    restPresetRepository,
    activeWorkoutSessionRepository,
    showRepositoryError,
  ])

  const openCreateForm = () => {
    setFormMode({ type: 'create' })
    setFormValues(emptyForm)
    setFormErrors({})
    setPicker(null)
    setRepositoryError(null)
  }

  const openEditForm = async (templateId: string) => {
    setRepositoryError(null)

    try {
      const template = await repository.getById(templateId)
      if (!template) {
        throw new Error(
          `Workout template with id "${templateId}" was not found.`,
        )
      }

      setFormMode({ type: 'edit', templateId })
      setFormValues({ name: template.name, steps: [...template.steps] })
      setFormErrors({})
      setPicker(null)
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось открыть тренировку. Попробуйте ещё раз.',
      )
    }
  }

  const closeForm = () => {
    setFormMode(null)
    setFormValues(emptyForm)
    setFormErrors({})
    setPicker(null)
  }

  const appendStep = (step: WorkoutTemplateStep) => {
    setFormValues((current) => ({
      ...current,
      steps: addStep(current.steps, step),
    }))
    setFormErrors((current) => ({ ...current, steps: undefined }))
    setPicker(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateWorkoutTemplateForm(formValues)

    if (!validation.success) {
      setFormErrors(validation.errors)
      return
    }

    setIsSaving(true)
    setFormErrors({})
    setRepositoryError(null)

    try {
      if (formMode?.type === 'edit') {
        await repository.update(formMode.templateId, validation.value)
      } else {
        await repository.create(validation.value)
      }

      closeForm()
      await loadData()
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось сохранить тренировку. Попробуйте ещё раз.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!templateToRemove) return

    setIsSaving(true)
    setRepositoryError(null)

    try {
      await repository.remove(templateToRemove.id)
      setTemplateToRemove(null)
      await loadData()
    } catch (error) {
      showRepositoryError(
        error,
        'Не удалось удалить тренировку. Попробуйте ещё раз.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const getStepName = (step: WorkoutTemplateStep): string => {
    if (step.type === 'exercise') {
      return exerciseById.get(step.exerciseId)?.name ?? 'Удалённое упражнение'
    }

    const preset = restPresetById.get(step.restPresetId)
    return preset
      ? formatRestDuration(preset.durationSeconds)
      : 'Удалённый вариант отдыха'
  }

  const resolveTemplateSnapshot = (
    template: WorkoutTemplateRecord,
  ): WorkoutTemplate | undefined => {
    const steps: WorkoutTemplate['steps'][number][] = []
    for (const step of template.steps) {
      if (step.type === 'exercise') {
        const exercise = exerciseById.get(step.exerciseId)
        if (!exercise) return undefined
        steps.push({ type: 'exercise', exercise })
      } else {
        const restPreset = restPresetById.get(step.restPresetId)
        if (!restPreset) return undefined
        steps.push({ type: 'rest', restPreset })
      }
    }
    return { id: template.id, name: template.name, steps }
  }

  const startTemplate = async (template: WorkoutTemplateRecord) => {
    if (feedbackSettings.soundEnabled) {
      const audioPrepared = await audioService.prepare()
      setAudioWarning(!audioPrepared.success)
    }
    const snapshot = resolveTemplateSnapshot(template)
    if (!snapshot) {
      setRepositoryError('Не удалось начать тренировку: один из шагов удалён из справочника.')
      return
    }
    const created = createActiveWorkoutSession(snapshot)
    if (!created.success) return
    const started = startWorkout(created.value, now())
    if (!started.success) return

    setIsSaving(true)
    setRepositoryError(null)
    try {
      await activeWorkoutSessionRepository.save(started.value)
      setActiveSession(started.value)
      setTemplateToStart(null)
      navigate('/workout-session')
    } catch (error) {
      showRepositoryError(error, 'Не удалось начать тренировку. Попробуйте ещё раз.')
    } finally {
      setIsSaving(false)
    }
  }

  const requestStart = (template: WorkoutTemplateRecord) => {
    if (activeSession && activeSession.status !== 'completed') {
      setTemplateToStart(template)
    } else {
      void startTemplate(template)
    }
  }

  const replaceActiveSession = async () => {
    if (!templateToStart) return
    setIsSaving(true)
    try {
      await activeWorkoutSessionRepository.clear()
      setActiveSession(undefined)
      await startTemplate(templateToStart)
    } catch (error) {
      showRepositoryError(error, 'Не удалось заменить активную тренировку. Попробуйте ещё раз.')
      setIsSaving(false)
    }
  }

  return (
    <CatalogPageLayout
      activePage="workouts"
      title="Тренировки"
      actionLabel="Создать тренировку"
      onAction={openCreateForm}
    >
      {repositoryError ? (
        <RepositoryErrorAlert message={repositoryError} />
      ) : null}

      {audioWarning ? <p role="status" className="mt-4 text-sm text-amber-300">Браузер может не воспроизвести сигнал автоматически.</p> : null}

      <WorkoutFeedbackSettingsPanel
        settings={feedbackSettings}
        onChange={setFeedbackSettings}
        store={feedbackSettingsStore}
        audioService={audioService}
        vibrationService={vibrationService}
      />

      {activeSession && activeSession.status !== 'completed' ? (
        <section className="mt-6 rounded-2xl border border-lime-900 bg-lime-950/30 p-5" aria-label="Незавершённая тренировка">
          <p className="text-sm text-lime-300">Есть незавершённая тренировка</p>
          <h2 className="mt-1 text-lg font-semibold">{activeSession.templateSnapshot.name}</h2>
          <p className="mt-1 text-sm text-slate-400">Шаг {activeSession.currentStepIndex + 1} из {activeSession.templateSnapshot.steps.length}</p>
          <button type="button" className="mt-3 min-h-11 font-semibold text-lime-300" onClick={() => navigate('/workout-session')}>Продолжить</button>
        </section>
      ) : null}

      {templateToStart ? (
        <section role="alertdialog" aria-labelledby="replace-session-title" className="mt-6 rounded-2xl border border-amber-800 bg-amber-950/30 p-5">
          <h2 id="replace-session-title" className="font-semibold">Уже есть незавершённая тренировка</h2>
          <p className="mt-2 text-sm text-slate-300">Чтобы начать «{templateToStart.name}», сначала завершите текущую.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="min-h-11 rounded-xl border border-slate-700 px-4" onClick={() => navigate('/workout-session')}>Продолжить текущую</button>
            <button type="button" disabled={isSaving} className="min-h-11 rounded-xl bg-red-500 px-4 font-semibold" onClick={() => void replaceActiveSession()}>Завершить и начать новую</button>
            <button type="button" className="min-h-11 px-4" onClick={() => setTemplateToStart(null)}>Отмена</button>
          </div>
        </section>
      ) : null}

      {formMode ? (
        <section
          aria-labelledby="workout-form-title"
          className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
        >
          <h2 id="workout-form-title" className="text-xl font-semibold">
            {formMode.type === 'create'
              ? 'Новая тренировка'
              : 'Изменить тренировку'}
          </h2>

          <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="workout-name" className="text-sm font-medium">
                Название тренировки
              </label>
              <input
                id="workout-name"
                autoFocus
                value={formValues.name}
                maxLength={WORKOUT_TEMPLATE_NAME_MAX_LENGTH}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={
                  formErrors.name ? 'workout-name-error' : undefined
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base outline-none focus:border-lime-300"
              />
              {formErrors.name ? (
                <p
                  id="workout-name-error"
                  className="mt-2 text-sm text-red-300"
                >
                  {formErrors.name}
                </p>
              ) : null}
            </div>

            <fieldset>
              <legend className="text-sm font-medium">
                Последовательность шагов
              </legend>
              {formValues.steps.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  Шагов пока нет.
                </p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {formValues.steps.map((step, index) => (
                    <li
                      key={step.id}
                      className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                    >
                      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        {step.type === 'exercise' ? 'Упражнение' : 'Отдых'}
                      </p>
                      <p className="mt-1 font-medium">{getStepName(step)}</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() =>
                            setFormValues((current) => ({
                              ...current,
                              steps: moveStepUp(current.steps, step.id),
                            }))
                          }
                          className="min-h-11 text-sm font-semibold text-lime-300 disabled:text-slate-600"
                        >
                          Выше
                        </button>
                        <button
                          type="button"
                          disabled={index === formValues.steps.length - 1}
                          onClick={() =>
                            setFormValues((current) => ({
                              ...current,
                              steps: moveStepDown(current.steps, step.id),
                            }))
                          }
                          className="min-h-11 text-sm font-semibold text-lime-300 disabled:text-slate-600"
                        >
                          Ниже
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormValues((current) => ({
                              ...current,
                              steps: removeStep(current.steps, step.id),
                            }))
                          }
                          className="min-h-11 text-sm font-semibold text-red-300"
                        >
                          Удалить шаг
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {formErrors.steps ? (
                <p className="mt-2 text-sm text-red-300">{formErrors.steps}</p>
              ) : null}
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setPicker('exercise')}
                className="min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold"
              >
                Добавить упражнение
              </button>
              <button
                type="button"
                onClick={() => setPicker('rest')}
                className="min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold"
              >
                Добавить отдых
              </button>
            </div>

            {picker === 'exercise' ? (
              <section
                aria-label="Выбор упражнения"
                className="rounded-xl bg-slate-800 p-4"
              >
                {exercises.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    Упражнения ещё не созданы.{' '}
                    <a
                      href="/exercises"
                      className="font-semibold text-lime-300"
                    >
                      Перейти к упражнениям
                    </a>
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {exercises.map((exercise) => (
                      <li key={exercise.id}>
                        <button
                          type="button"
                          onClick={() =>
                            appendStep({
                              id: crypto.randomUUID(),
                              type: 'exercise',
                              exerciseId: exercise.id,
                            })
                          }
                          className="min-h-11 w-full rounded-lg bg-slate-950 px-3 py-2 text-left text-sm"
                        >
                          {exercise.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            {picker === 'rest' ? (
              <section
                aria-label="Выбор отдыха"
                className="rounded-xl bg-slate-800 p-4"
              >
                {restPresets.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    Варианты отдыха ещё не созданы.{' '}
                    <a
                      href="/rest-presets"
                      className="font-semibold text-lime-300"
                    >
                      Перейти к отдыху
                    </a>
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {restPresets.map((preset) => (
                      <li key={preset.id}>
                        <button
                          type="button"
                          onClick={() =>
                            appendStep({
                              id: crypto.randomUUID(),
                              type: 'rest',
                              restPresetId: preset.id,
                            })
                          }
                          className="min-h-11 w-full rounded-lg bg-slate-950 px-3 py-2 text-left text-sm"
                        >
                          <span className="font-medium">{preset.name}</span>
                          <span className="block text-slate-400">
                            {formatRestDuration(preset.durationSeconds)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-11 rounded-xl bg-lime-300 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50"
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

      <section aria-label="Список тренировок" className="mt-6">
        {isLoading ? (
          <p className="py-12 text-center text-slate-400">Загрузка…</p>
        ) : templates.length === 0 ? (
          <CatalogEmptyState
            title="Тренировок пока нет"
            description="Создайте первый шаблон тренировки из упражнений и отдыха."
          />
        ) : (
          <ul className="space-y-3">
            {templates.map((template) => (
              <li
                key={template.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <h2 className="text-lg font-semibold">{template.name}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {stepCountLabel(template.steps.length)}
                </p>
                <p className="mt-2 truncate text-sm text-slate-400">
                  {template.steps.length === 0
                    ? 'Пустой шаблон'
                    : template.steps.slice(0, 4).map(getStepName).join(' → ') +
                      (template.steps.length > 4 ? ' → …' : '')}
                </p>
                {templateToRemove?.id === template.id ? (
                  <DeleteConfirmation
                    labelId={`remove-workout-${template.id}`}
                    message={`Удалить тренировку «${template.name}»?`}
                    isBusy={isSaving}
                    onConfirm={() => void handleRemove()}
                    onCancel={() => setTemplateToRemove(null)}
                  />
                ) : (
                  <div className="mt-4 flex gap-4">
                    <button
                      type="button"
                      disabled={template.steps.length === 0 || isSaving}
                      onClick={() => requestStart(template)}
                      className="min-h-11 text-sm font-semibold text-lime-300 disabled:text-slate-600"
                    >
                      Начать
                    </button>
                    <button
                      type="button"
                      onClick={() => void openEditForm(template.id)}
                      className="min-h-11 text-sm font-semibold text-lime-300"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateToRemove(template)}
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
