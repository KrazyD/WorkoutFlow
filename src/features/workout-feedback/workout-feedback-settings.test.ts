import { describe, expect, it } from 'vitest'

import {
  DEFAULT_WORKOUT_FEEDBACK_SETTINGS,
  WORKOUT_FEEDBACK_SETTINGS_KEY,
  createWorkoutFeedbackSettingsStore,
} from './workout-feedback-settings'

const memoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('workout feedback settings', () => {
  it('enables sound and vibration by default', () => {
    expect(createWorkoutFeedbackSettingsStore(memoryStorage()).load()).toEqual(
      DEFAULT_WORKOUT_FEEDBACK_SETTINGS,
    )
  })

  it('saves and restores settings', () => {
    const storage = memoryStorage()
    const store = createWorkoutFeedbackSettingsStore(storage)
    store.save({ soundEnabled: false, vibrationEnabled: true })
    expect(createWorkoutFeedbackSettingsStore(storage).load()).toEqual({
      soundEnabled: false,
      vibrationEnabled: true,
    })
  })

  it('replaces malformed saved data with defaults', () => {
    const storage = memoryStorage()
    storage.setItem(WORKOUT_FEEDBACK_SETTINGS_KEY, '{broken')
    expect(createWorkoutFeedbackSettingsStore(storage).load()).toEqual(
      DEFAULT_WORKOUT_FEEDBACK_SETTINGS,
    )
    storage.setItem(WORKOUT_FEEDBACK_SETTINGS_KEY, JSON.stringify({ soundEnabled: 'yes' }))
    expect(createWorkoutFeedbackSettingsStore(storage).load()).toEqual(
      DEFAULT_WORKOUT_FEEDBACK_SETTINGS,
    )
  })
})

