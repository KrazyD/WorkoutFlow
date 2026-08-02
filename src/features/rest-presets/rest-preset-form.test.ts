import { describe, expect, it } from 'vitest'

import { validateRestPresetForm } from './rest-preset-form'

describe('validateRestPresetForm', () => {
  it('trims the name and converts duration to seconds', () => {
    expect(
      validateRestPresetForm({
        name: '  Обычный  ',
        minutes: '1',
        seconds: '30',
      }),
    ).toEqual({
      success: true,
      value: { name: 'Обычный', durationSeconds: 90 },
    })
  })

  it('accepts the minimum duration', () => {
    expect(
      validateRestPresetForm({ name: 'Минимум', minutes: '0', seconds: '5' }),
    ).toEqual({
      success: true,
      value: { name: 'Минимум', durationSeconds: 5 },
    })
  })

  it('accepts the maximum duration', () => {
    expect(
      validateRestPresetForm({
        name: 'Максимум',
        minutes: '60',
        seconds: '0',
      }),
    ).toEqual({
      success: true,
      value: { name: 'Максимум', durationSeconds: 3_600 },
    })
  })

  it('rejects a duration above the maximum', () => {
    expect(
      validateRestPresetForm({
        name: 'Слишком долго',
        minutes: '60',
        seconds: '1',
      }),
    ).toEqual({
      success: false,
      errors: { duration: 'Максимальная продолжительность — 60 минут.' },
    })
  })

  it('rejects fractional values', () => {
    expect(
      validateRestPresetForm({
        name: 'Дробный',
        minutes: '1.5',
        seconds: '0',
      }),
    ).toEqual({
      success: false,
      errors: { minutes: 'Введите целое число от 0 до 60.' },
    })
  })
})
