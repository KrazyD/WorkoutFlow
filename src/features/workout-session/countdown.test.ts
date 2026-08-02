import { describe, expect, it } from 'vitest'

import { formatCountdown } from './countdown'

describe('formatCountdown', () => {
  it.each([
    [0, '00:00'],
    [5, '00:05'],
    [65, '01:05'],
    [600, '10:00'],
    [3_600, '60:00'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected)
  })
})
