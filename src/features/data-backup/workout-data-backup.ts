import { z } from 'zod'

import type { Exercise, RestPreset } from '../../domain/workout-session'
import type { WorkoutTemplateRecord } from '../../domain/workout-template'
import { EXERCISE_DESCRIPTION_MAX_LENGTH, EXERCISE_NAME_MAX_LENGTH } from '../exercises/exercise-form'
import { REST_DURATION_MAX_SECONDS, REST_DURATION_MIN_SECONDS, REST_PRESET_NAME_MAX_LENGTH } from '../rest-presets/rest-preset-form'
import type { WorkoutFeedbackSettings } from '../workout-feedback/workout-feedback-settings'
import { WORKOUT_TEMPLATE_NAME_MAX_LENGTH } from '../workout-templates/workout-template-form'

export const EXPORT_FORMAT = 'workout-flow-export' as const
export const CURRENT_EXPORT_VERSION = 1 as const
export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024

export interface WorkoutFlowExportV1 {
  readonly format: typeof EXPORT_FORMAT
  readonly version: typeof CURRENT_EXPORT_VERSION
  readonly exportedAt: string
  readonly data: {
    readonly exercises: readonly Exercise[]
    readonly restPresets: readonly RestPreset[]
    readonly workoutTemplates: readonly WorkoutTemplateRecord[]
    readonly feedbackSettings: WorkoutFeedbackSettings
  }
}

export type ImportValidationResult =
  | { readonly success: true; readonly data: WorkoutFlowExportV1 }
  | { readonly success: false; readonly message: string }

export interface WorkoutDataBackupService {
  exportData(): Promise<WorkoutFlowExportV1>
  validateImport(input: unknown): ImportValidationResult
  importData(data: WorkoutFlowExportV1): Promise<void>
}

export class ActiveWorkoutImportError extends Error {}
export class FeedbackSettingsImportError extends Error {}

const trimmedNonEmpty = (max: number) => z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(max))
const idSchema = z.string().refine((value) => value.trim().length > 0)

const exerciseSchema = z.object({
  id: idSchema,
  name: trimmedNonEmpty(EXERCISE_NAME_MAX_LENGTH),
  description: z.string().max(EXERCISE_DESCRIPTION_MAX_LENGTH).transform((value) => value.trim()).optional(),
}).strict().transform(({ description, ...exercise }) => ({
  ...exercise,
  ...(description ? { description } : {}),
}))

const restPresetSchema = z.object({
  id: idSchema,
  name: trimmedNonEmpty(REST_PRESET_NAME_MAX_LENGTH),
  durationSeconds: z.number().int().min(REST_DURATION_MIN_SECONDS).max(REST_DURATION_MAX_SECONDS),
}).strict()

const workoutStepSchema = z.discriminatedUnion('type', [
  z.object({ id: idSchema, type: z.literal('exercise'), exerciseId: idSchema }).strict(),
  z.object({ id: idSchema, type: z.literal('rest'), restPresetId: idSchema }).strict(),
])

const workoutTemplateSchema = z.object({
  id: idSchema,
  name: trimmedNonEmpty(WORKOUT_TEMPLATE_NAME_MAX_LENGTH),
  steps: z.array(workoutStepSchema).min(1),
}).strict()

const feedbackSettingsSchema = z.object({
  soundEnabled: z.boolean(),
  vibrationEnabled: z.boolean(),
}).strict()

const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(CURRENT_EXPORT_VERSION),
  exportedAt: z.iso.datetime(),
  data: z.object({
    exercises: z.array(exerciseSchema),
    restPresets: z.array(restPresetSchema),
    workoutTemplates: z.array(workoutTemplateSchema),
    feedbackSettings: feedbackSettingsSchema,
  }).strict(),
}).strict()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const duplicate = (ids: readonly string[]): boolean => new Set(ids).size !== ids.length

export function validateWorkoutFlowImport(input: unknown): ImportValidationResult {
  if (!isRecord(input) || input.format !== EXPORT_FORMAT)
    return { success: false, message: 'Это не файл резервной копии Workout Flow' }
  if (input.version !== CURRENT_EXPORT_VERSION)
    return { success: false, message: 'Версия резервной копии не поддерживается' }
  if (!('data' in input))
    return { success: false, message: 'В файле отсутствуют данные резервной копии' }

  const parsed = exportSchema.safeParse(input)
  if (!parsed.success) {
    const firstPath = parsed.error.issues[0]?.path
    const section = firstPath?.[0] === 'data' ? firstPath[1] : firstPath?.[0]
    if (section === 'exercises') return { success: false, message: 'В файле есть некорректные упражнения' }
    if (section === 'restPresets') return { success: false, message: 'В файле есть некорректные варианты отдыха' }
    if (section === 'workoutTemplates') return { success: false, message: 'В файле есть некорректные тренировки' }
    if (section === 'feedbackSettings') return { success: false, message: 'В файле есть некорректные настройки оповещений' }
    return { success: false, message: 'Файл резервной копии имеет некорректную структуру' }
  }

  const { exercises, restPresets, workoutTemplates } = parsed.data.data
  if (duplicate(exercises.map(({ id }) => id)))
    return { success: false, message: 'В файле повторяются ID упражнений' }
  if (duplicate(restPresets.map(({ id }) => id)))
    return { success: false, message: 'В файле повторяются ID вариантов отдыха' }
  if (duplicate(workoutTemplates.map(({ id }) => id)))
    return { success: false, message: 'В файле повторяются ID тренировок' }

  const exerciseIds = new Set(exercises.map(({ id }) => id))
  const restPresetIds = new Set(restPresets.map(({ id }) => id))
  for (const template of workoutTemplates) {
    if (duplicate(template.steps.map(({ id }) => id)))
      return { success: false, message: `В тренировке «${template.name}» повторяются ID шагов` }
    for (const step of template.steps) {
      if (step.type === 'exercise' && !exerciseIds.has(step.exerciseId))
        return { success: false, message: 'Шаблон ссылается на отсутствующее упражнение' }
      if (step.type === 'rest' && !restPresetIds.has(step.restPresetId))
        return { success: false, message: 'Шаблон ссылается на отсутствующий вариант отдыха' }
    }
  }

  return { success: true, data: parsed.data }
}

export const serializeWorkoutFlowExport = (data: WorkoutFlowExportV1): string =>
  JSON.stringify(data, null, 2)

export const createBackupFileName = (exportedAt: string): string => {
  const date = new Date(exportedAt)
  const day = date.toISOString().slice(0, 10)
  const time = date.toISOString().slice(11, 19).replaceAll(':', '-')
  return `workout-flow-backup-${day}-${time}.json`
}

export interface BackupDownloadEnvironment {
  readonly createObjectURL: (blob: Blob) => string
  readonly revokeObjectURL: (url: string) => void
  readonly createAnchor: () => Pick<HTMLAnchorElement, 'href' | 'download' | 'click' | 'remove'>
}

const browserDownloadEnvironment: BackupDownloadEnvironment = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  createAnchor: () => document.createElement('a'),
}

export function downloadWorkoutFlowExport(
  data: WorkoutFlowExportV1,
  environment: BackupDownloadEnvironment = browserDownloadEnvironment,
): void {
  const blob = new Blob([serializeWorkoutFlowExport(data)], { type: 'application/json' })
  const url = environment.createObjectURL(blob)
  const anchor = environment.createAnchor()
  try {
    anchor.href = url
    anchor.download = createBackupFileName(data.exportedAt)
    anchor.click()
  } finally {
    anchor.remove()
    environment.revokeObjectURL(url)
  }
}
