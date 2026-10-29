import type { WeightInputResult } from './working-weight'

export function parseWorkingReps(input: string): WeightInputResult {
  const normalized = input.trim()
  if (!normalized) return { success: true, value: null }
  const value = Number(normalized)
  if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(value) || value <= 0)
    return {
      success: false,
      message: 'Введите целое положительное число повторений.',
    }
  return { success: true, value }
}
