export type WeightInputResult =
  | { readonly success: true; readonly value: number | null }
  | { readonly success: false; readonly message: string }

export function parseWorkingWeight(input: string): WeightInputResult {
  const normalized = input.trim().replace(',', '.')
  if (!normalized) return { success: true, value: null }
  if (
    !/^\d+(\.\d+)?$/.test(normalized) ||
    !Number.isFinite(Number(normalized))
  ) {
    return {
      success: false,
      message: 'Введите неотрицательный вес, например 59,1.',
    }
  }
  return { success: true, value: Number(normalized) }
}

export function formatWorkingWeight(weight: number | null | undefined): string {
  return weight == null
    ? 'Вес не указан'
    : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 20 }).format(weight)} кг`
}
