import { Temporal } from '@js-temporal/polyfill';

export interface RefinancingRateResponse {
  Date: string;
  Value: number;
}

export interface RefinancingRateInfo {
  rate: number;
  date: string;
}

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

export function createRefinancingRateService() {
  return {
    async fetchRefinancingRate(date?: string): Promise<RefinancingRateInfo> {
      throw new Error('External API calls are not available in shared module. Use server API endpoints instead.');
    },

    async getRefinancingRateForDate(
      inputDate: Temporal.PlainDate | Date | string
    ): Promise<RefinancingRateInfo> {
      throw new Error('External API calls are not available in shared module. Use server API endpoints instead.');
    }
  };
}

export type RefinancingRateService = ReturnType<typeof createRefinancingRateService>;