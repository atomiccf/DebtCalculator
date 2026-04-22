import { Temporal } from '@js-temporal/polyfill';

export interface RefinancingRate {
  value: number;
  date: string;
}

export interface RefinancingRateHistory {
  value: number;
  dateFrom: string;
  dateTo?: string;
  act: string;
}

export const refinancingRateHistory: RefinancingRateHistory[] = [
  { value: 10, dateFrom: '2025-03-20', act: 'Постановление Правления НБРБ от 19.03.2025 №86' },
  { value: 9.5, dateFrom: '2024-10-18', act: 'Постановление Правления НБРБ от 17.10.2024 №283' },
  { value: 10, dateFrom: '2024-07-19', act: 'Постановление Правления НБРБ от 18.07.2024 №198' },
  { value: 11, dateFrom: '2024-04-17', act: 'Постановление Правления НБРБ от 16.04.2024 №108' },
  { value: 12.5, dateFrom: '2024-01-23', act: 'Постановление Правления НБРБ от 22.01.2024 №25' },
  { value: 14, dateFrom: '2023-12-12', act: 'Постановление Правления НБРБ от 11.12.2023 №371' },
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

export function getRefinancingRate(date?: Temporal.PlainDate | Date | string): number {
  const checkDate = date ? parseDate(date) : Temporal.Now.plainDateISO();
  
  for (const record of refinancingRateHistory) {
    const recordDate = Temporal.PlainDate.from(record.dateFrom);
    if (checkDate.since(recordDate).days >= 0) {
      return record.value;
    }
  }
  
  return refinancingRateHistory[refinancingRateHistory.length - 1].value;
}

export function getRefinancingRateInfo(date?: Temporal.PlainDate | Date | string): RefinancingRateHistory {
  const checkDate = date ? parseDate(date) : Temporal.Now.plainDateISO();
  
  for (const record of refinancingRateHistory) {
    const recordDate = Temporal.PlainDate.from(record.dateFrom);
    if (checkDate.since(recordDate).days >= 0) {
      return record;
    }
  }
  
  return refinancingRateHistory[refinancingRateHistory.length - 1];
}

export function getCurrentRefinancingRate(): number {
  return refinancingRateHistory[0].value;
}