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
  { value: 9.75, dateFrom: '2025-06-25', act: 'Постановление Правления НБРБ от 23.06.2025 №163' },
  { value: 9.5, dateFrom: '2024-10-18', act: 'Постановление Правления НБРБ от 17.10.2024 №283' },
  { value: 10, dateFrom: '2024-07-19', act: 'Постановление Правления НБРБ от 18.07.2024 №198' },
  { value: 11, dateFrom: '2024-04-17', act: 'Постановление Правления НБРБ от 16.04.2024 №108' },
  { value: 12.5, dateFrom: '2024-01-23', act: 'Постановление Правления НБРБ от 22.01.2024 №25' },
  { value: 14, dateFrom: '2023-12-12', act: 'Постановление Правления НБРБ от 11.12.2023 №371' },
  { value: 11.5, dateFrom: '2023-01-23', act: 'Постановление Правления НБРБ от 18.01.2023 №19' },
  { value: 12, dateFrom: '2022-03-01', act: 'Постановление Правления НБРБ от 28.02.2022 №95' },
  { value: 9.25, dateFrom: '2021-07-21', act: 'Постановление Правления НБРБ от 15.07.2021 №203' },
  { value: 8.5, dateFrom: '2021-04-21', act: 'Постановление Правления НБРБ от 14.04.2021 №94' },
  { value: 7.75, dateFrom: '2020-07-01', act: 'Постановление Правления НБРБ от 20.11.2019' },
  { value: 9, dateFrom: '2019-08-20', act: 'Постановление Правления НБРБ' },
  { value: 9.5, dateFrom: '2019-04-22', act: 'Постановление Правления НБРБ' },
  { value: 10.5, dateFrom: '2019-01-23', act: 'Постановление Правления НБРБ' },
  { value: 11, dateFrom: '2018-12-20', act: 'Постановление Правления НБРБ' },
  { value: 10.5, dateFrom: '2018-09-14', act: 'Постановление Правления НБРБ' },
  { value: 10, dateFrom: '2018-06-13', act: 'Постановление Правления НБРБ' },
  { value: 9.5, dateFrom: '2018-03-20', act: 'Постановление Правления НБРБ' },
  { value: 9, dateFrom: '2018-01-23', act: 'Постановление Правления НБРБ' },
  { value: 9.5, dateFrom: '2017-10-03', act: 'Постановление Правления НБРБ' },
  { value: 10.5, dateFrom: '2017-04-20', act: 'Постановление Правления НБРБ' },
  { value: 11, dateFrom: '2017-03-23', act: 'Постановление Правления НБРБ' },
  { value: 12, dateFrom: '2016-12-20', act: 'Постановление Правления НБРБ' },
  { value: 14, dateFrom: '2016-10-04', act: 'Постановление Правления НБРБ' },
  { value: 18, dateFrom: '2016-03-30', act: 'Постановление Правления НБРБ' },
  { value: 25, dateFrom: '2016-01-06', act: 'Постановление Правления НБРБ' },
  { value: 25, dateFrom: '2015-12-23', act: 'Постановление Правления НБРБ' },
  { value: 24, dateFrom: '2015-11-19', act: 'Постановление Правления НБРБ' },
  { value: 23, dateFrom: '2015-07-23', act: 'Постановление Правления НБРБ' },
  { value: 25, dateFrom: '2015-05-18', act: 'Постановление Правления НБРБ' },
  { value: 26, dateFrom: '2015-01-23', act: 'Постановление Правления НБРБ' },
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