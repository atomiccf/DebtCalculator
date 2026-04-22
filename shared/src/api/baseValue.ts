import { Temporal } from '@js-temporal/polyfill';

export interface BaseValueRecord {
  value: number;
  dateFrom: string;
  act: string;
}

export const baseValueHistory: BaseValueRecord[] = [
  { value: 45, dateFrom: '2026-01-01', act: 'Постановление Совмина РБ от 20.11.2025 №651' },
  { value: 42, dateFrom: '2025-01-01', act: 'Постановление Совмина от 16.11.2024 №848' },
  { value: 40, dateFrom: '2024-01-01', act: 'Постановление Совмина от 27.12.2023 №944' },
  { value: 37, dateFrom: '2023-01-01', act: 'Постановление Совмина от 30.12.2022 №967' },
  { value: 32, dateFrom: '2022-01-01', act: 'Постановление Совмина от 31.12.2021 №792' },
  { value: 29, dateFrom: '2021-01-01', act: 'Постановление Совмина от 30.12.2020 №783' },
  { value: 27, dateFrom: '2020-01-01', act: 'Постановление Совмина от 13.12.2019 №861' },
  { value: 25.5, dateFrom: '2019-01-01', act: 'Постановление Совмина от 27.12.2018 №956' },
];

function parseDate(date: Temporal.PlainDate | Date | string): Temporal.PlainDate {
  if (date instanceof Date) {
    return Temporal.PlainDate.from({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    });
  }
  if (typeof date === 'string') {
    return Temporal.PlainDate.from(date);
  }
  return date;
}

export function getBaseValue(date?: Temporal.PlainDate | Date | string): number {
  const checkDate = date ? parseDate(date) : Temporal.Now.plainDateISO();
  
  for (const record of baseValueHistory) {
    const recordDate = Temporal.PlainDate.from(record.dateFrom);
    if (checkDate.since(recordDate).days >= 0) {
      return record.value;
    }
  }
  
  return baseValueHistory[baseValueHistory.length - 1].value;
}

export function getBaseValueInfo(date?: Temporal.PlainDate | Date | string): BaseValueRecord {
  const checkDate = date ? parseDate(date) : Temporal.Now.plainDateISO();
  
  for (const record of baseValueHistory) {
    const recordDate = Temporal.PlainDate.from(record.dateFrom);
    if (checkDate.since(recordDate).days >= 0) {
      return record;
    }
  }
  
  return baseValueHistory[baseValueHistory.length - 1];
}