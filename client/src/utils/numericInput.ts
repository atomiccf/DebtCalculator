import { toMinorUnits } from 'jurist-calculator-shared'

// Keep the original text in form state; convert only at the request boundary.
export function parseNumericInput(value: string, money = false): number {
  const text = value.trim()
  const pattern = money
    ? /^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/
    : /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/
  if (!pattern.test(text)) return NaN
  const normalized = text.replace(',', '.')
  const number = Number(normalized)
  if (!Number.isFinite(number)) return NaN
  if (money) {
    const [whole, fraction = ''] = normalized.split('.')
    const minor = BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0'))
    try {
      if (toMinorUnits(number) !== minor) return NaN
    } catch {
      return NaN
    }
  }
  return number
}
