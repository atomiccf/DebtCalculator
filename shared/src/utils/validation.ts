export function assertRecord(value: unknown, label = 'Данные'): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} должны быть объектом`);
  }
}

export function assertNonNegativeNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label}: необходимо конечное неотрицательное число`);
  }
}

export function assertPositiveNumber(value: unknown, label: string): asserts value is number {
  assertNonNegativeNumber(value, label);
  if (value === 0) throw new Error(`${label} должна быть больше 0`);
}
