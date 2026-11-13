import { DateInput, today } from '../utils/dateUtils';
import { getEffectiveRecord, withEffectiveDates } from '../referenceData/effectiveRecord';

export interface BaseValueRecord {
  value: number;
  dateFrom: string;
  act: string;
  dateTo?: string;
  supportedThrough?: string;
  source: string;
  version: string;
  verifiedOn?: string;
}

export const baseValueHistory: readonly Readonly<BaseValueRecord>[] = withEffectiveDates([
  { value: 45, dateFrom: '2026-01-01', act: 'Постановление Совмина РБ от 20.11.2025 №651' },
  { value: 42, dateFrom: '2025-01-01', act: 'Постановление Совмина от 16.11.2024 №848' },
  { value: 40, dateFrom: '2024-01-01', act: 'Постановление Совмина от 27.12.2023 №944' },
  { value: 37, dateFrom: '2023-01-01', act: 'Постановление Совмина от 30.12.2022 №967' },
  { value: 32, dateFrom: '2022-01-01', act: 'Постановление Совмина от 31.12.2021 №792' },
  { value: 29, dateFrom: '2021-01-01', act: 'Постановление Совмина от 30.12.2020 №783' },
  { value: 27, dateFrom: '2020-01-01', act: 'Постановление Совмина от 13.12.2019 №861' },
  { value: 25.5, dateFrom: '2019-01-01', act: 'Постановление Совмина от 27.12.2018 №956' },
].map((record, index) => ({ ...record, version: 'by-base-value-history-2026-11-13',
  source: index === 0 ? 'https://nalog.gov.by/news/33270/' : record.act,
  ...(index === 0 ? { supportedThrough: '2026-12-31', verifiedOn: '2026-11-13' } : {}),
})));

export function getBaseValue(date: DateInput = today()): number {
  return getBaseValueInfo(date).value;
}
export function getBaseValueInfo(date: DateInput = today()): BaseValueRecord {
  return getEffectiveRecord(baseValueHistory, date);
}
