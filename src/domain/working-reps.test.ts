import { describe, expect, it } from 'vitest'
import { parseWorkingReps } from './working-reps'

describe('working repetitions', () => {
  it.each([
    ['', null],
    ['  ', null],
    ['10', 10],
    [' 15 ', 15],
  ])('parses %j', (input, value) => {
    expect(parseWorkingReps(input as string)).toEqual({ success: true, value })
  })
  it.each([
    '0',
    '-1',
    '1.5',
    '1,5',
    'ten',
    'NaN',
    'Infinity',
    '1e2',
    '9007199254740992',
  ])('rejects %j', (input) => {
    expect(parseWorkingReps(input).success).toBe(false)
  })
})
