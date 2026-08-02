import { describe, expect, it } from 'vitest'

import {
  formatRestDuration,
  fromDurationSeconds,
  toDurationSeconds,
} from './rest-duration'

describe('rest duration conversion', () => {
  it('converts minutes and seconds to total seconds', () => {
    expect(toDurationSeconds(1, 30)).toBe(90)
    expect(toDurationSeconds(60, 0)).toBe(3_600)
  })

  it('converts total seconds back to minutes and seconds', () => {
    expect(fromDurationSeconds(90)).toEqual({ minutes: 1, seconds: 30 })
    expect(fromDurationSeconds(3_600)).toEqual({ minutes: 60, seconds: 0 })
  })
})

describe('formatRestDuration', () => {
  it.each([
    [5, '5 секунд'],
    [21, '21 секунда'],
    [59, '59 секунд'],
    [60, '1 минута'],
    [90, '1 минута 30 секунд'],
    [120, '2 минуты'],
    [300, '5 минут'],
    [660, '11 минут'],
    [1_260, '21 минута'],
    [3_600, '60 минут'],
  ])('formats %i seconds as "%s"', (seconds, expected) => {
    expect(formatRestDuration(seconds)).toBe(expected)
  })
})
