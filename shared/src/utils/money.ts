import { CalculationError } from './calculationError';
import { assertNonNegativeNumber, assertPositiveNumber } from './validation';

// BigInts remain internal; public amounts are JSON-compatible numbers in BYN.
function decimalFraction(value: number): [bigint, bigint] {
  assertNonNegativeNumber(value, 'Сумма или ставка');
  const [mantissa, exponent = '0'] = value.toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  const numerator = BigInt(whole + fraction);
  return scale >= 0 ? [numerator, 10n ** BigInt(scale)] : [numerator * 10n ** BigInt(-scale), 1n];
}

function fromMinorUnits(minor: bigint): number {
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new CalculationError('Сумма превышает безопасный предел точности');
  const value = Number(minor) / 100;
  const [numerator, denominator] = decimalFraction(value);
  if (numerator * 100n !== minor * denominator) throw new CalculationError('Сумма теряет точность при преобразовании в число');
  return value;
}

// Duty percentages and multipliers need up to four fractional digits of a kopeck.
export function toDutyUnits(value: number): bigint {
  return toMinorUnits(value) * 10000n;
}

export function fromDutyUnits(value: bigint): number {
  return roundMoneyFraction(value, 1000000n);
}

export function toMinorUnits(value: number): bigint {
  const [numerator, denominator] = decimalFraction(value);
  if ((numerator * 100n) % denominator !== 0n) {
    throw new CalculationError('Денежная сумма должна содержать не более двух знаков после запятой');
  }
  const minor = numerator * 100n / denominator;
  fromMinorUnits(minor);
  return minor;
}

export function assertPositiveMoney(value: unknown, label = 'Сумма долга'): asserts value is number {
  assertPositiveNumber(value, label);
  toMinorUnits(value);
}

/** Round a nonnegative BYN fraction to kopecks, half up, exactly once. */
export function roundMoneyFraction(numerator: bigint, denominator: bigint): number {
  if (numerator < 0n || denominator <= 0n) throw new Error('Некорректная денежная дробь');
  return fromMinorUnits((numerator * 200n + denominator) / (denominator * 2n));
}

export function roundMoney(value: number): number {
  const [numerator, denominator] = decimalFraction(value);
  return roundMoneyFraction(numerator, denominator);
}

export function sumMoney(values: readonly number[]): number {
  return fromMinorUnits(values.reduce((sum, value) => sum + toMinorUnits(value), 0n));
}

/** debt * percent / 100 * numerator / denominator, rounded half up to kopecks. */
export function calculateMoneyAccrual(debt: number, percent: number, numerator: bigint, denominator = 1n): number {
  assertPositiveMoney(debt);
  const [rateNumerator, rateDenominator] = decimalFraction(percent);
  return roundMoneyFraction(toMinorUnits(debt) * rateNumerator * numerator,
    10000n * rateDenominator * denominator);
}
