import type {
  CreateRestPresetInput,
  UpdateRestPresetInput,
} from './rest-preset-repository'
import { toDurationSeconds } from './rest-duration'

export const REST_PRESET_NAME_MAX_LENGTH = 100
export const REST_MINUTES_MAX = 60
export const REST_SECONDS_MAX = 59
export const REST_DURATION_MIN_SECONDS = 5
export const REST_DURATION_MAX_SECONDS = 3_600

export interface RestPresetFormValues {
  readonly name: string
  readonly minutes: string
  readonly seconds: string
}

export interface RestPresetFormErrors {
  readonly name?: string
  readonly minutes?: string
  readonly seconds?: string
  readonly duration?: string
}

export type RestPresetFormResult =
  | {
      readonly success: true
      readonly value: CreateRestPresetInput | UpdateRestPresetInput
    }
  | { readonly success: false; readonly errors: RestPresetFormErrors }

const parseWholeNumber = (value: string): number | undefined => {
  const normalized = value.trim()

  if (!/^\d+$/.test(normalized)) {
    return undefined
  }

  return Number(normalized)
}

export function validateRestPresetForm(
  values: RestPresetFormValues,
): RestPresetFormResult {
  const name = values.name.trim()
  const minutes = parseWholeNumber(values.minutes)
  const seconds = parseWholeNumber(values.seconds)
  const errors: {
    name?: string
    minutes?: string
    seconds?: string
    duration?: string
  } = {}

  if (name.length === 0) {
    errors.name = 'Введите название варианта отдыха.'
  } else if (name.length > REST_PRESET_NAME_MAX_LENGTH) {
    errors.name = `Название должно содержать не более ${REST_PRESET_NAME_MAX_LENGTH} символов.`
  }

  if (minutes === undefined || minutes > REST_MINUTES_MAX) {
    errors.minutes = `Введите целое число от 0 до ${REST_MINUTES_MAX}.`
  }

  if (seconds === undefined || seconds > REST_SECONDS_MAX) {
    errors.seconds = `Введите целое число от 0 до ${REST_SECONDS_MAX}.`
  }

  if (
    minutes !== undefined &&
    seconds !== undefined &&
    !errors.minutes &&
    !errors.seconds
  ) {
    const durationSeconds = toDurationSeconds(minutes, seconds)

    if (durationSeconds === 0) {
      errors.duration = 'Продолжительность не может быть нулевой.'
    } else if (durationSeconds < REST_DURATION_MIN_SECONDS) {
      errors.duration = `Минимальная продолжительность — ${REST_DURATION_MIN_SECONDS} секунд.`
    } else if (durationSeconds > REST_DURATION_MAX_SECONDS) {
      errors.duration = 'Максимальная продолжительность — 60 минут.'
    }
  }

  if (errors.name || errors.minutes || errors.seconds || errors.duration) {
    return { success: false, errors }
  }

  return {
    success: true,
    value: {
      name,
      durationSeconds: toDurationSeconds(minutes!, seconds!),
    },
  }
}
