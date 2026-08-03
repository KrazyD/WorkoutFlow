import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  REST_FINISHED_VIBRATION_PATTERN,
  workoutVibrationService,
} from './workout-vibration-service'

afterEach(() => vi.restoreAllMocks())

describe('workout vibration service', () => {
  it('reports unsupported when vibrate is absent', () => {
    vi.stubGlobal('navigator', {})
    expect(workoutVibrationService.isSupported()).toBe(false)
  })

  it('uses the short rest-finished pattern', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    expect(workoutVibrationService.vibrateRestFinished()).toBe(true)
    expect(vibrate).toHaveBeenCalledWith([...REST_FINISHED_VIBRATION_PATTERN])
  })

  it('contains vibration errors', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('denied') } })
    expect(workoutVibrationService.vibrateRestFinished()).toBe(false)
  })
})

