export interface RestDurationParts {
  readonly minutes: number
  readonly seconds: number
}

export function toDurationSeconds(minutes: number, seconds: number): number {
  return minutes * 60 + seconds
}

export function fromDurationSeconds(
  durationSeconds: number,
): RestDurationParts {
  return {
    minutes: Math.floor(durationSeconds / 60),
    seconds: durationSeconds % 60,
  }
}

const pluralize = (
  value: number,
  one: string,
  few: string,
  many: string,
): string => {
  const lastTwoDigits = value % 100
  const lastDigit = value % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return many
  }

  if (lastDigit === 1) {
    return one
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return few
  }

  return many
}

export function formatRestDuration(durationSeconds: number): string {
  const { minutes, seconds } = fromDurationSeconds(durationSeconds)
  const parts: string[] = []

  if (minutes > 0) {
    parts.push(`${minutes} ${pluralize(minutes, 'минута', 'минуты', 'минут')}`)
  }

  if (seconds > 0 || minutes === 0) {
    parts.push(
      `${seconds} ${pluralize(seconds, 'секунда', 'секунды', 'секунд')}`,
    )
  }

  return parts.join(' ')
}
