import { Temporal } from '@js-temporal/polyfill';

const NBRB_API = process.env.NBRB_API_URL || 'https://api.nbrb.by/refinancingrate';

export interface RefinancingRateResponse {
  Date: string;
  Value: number;
}

export interface RefinancingRateInfo {
  rate: number;
  date: string;
}

let rateCache: { rate: number; date: string; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

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

export class NbrbService {
  async fetchRefinancingRate(date?: string): Promise<RefinancingRateInfo> {
    const now = Date.now();

    if (rateCache && now - rateCache.timestamp < CACHE_TTL) {
      return { rate: rateCache.rate, date: rateCache.date };
    }

    try {
      const url = date 
        ? `${NBRB_API}?ondate=${date}`
        : NBRB_API;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`NBRB API error: ${response.status}`);
      }
      
      const data = await response.json() as RefinancingRateResponse[];
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Empty response from NBRB API');
      }

      const latest = data[0];
      
      rateCache = {
        rate: latest.Value,
        date: latest.Date,
        timestamp: now
      };
      
      return { rate: latest.Value, date: latest.Date };
      
    } catch (error) {
      console.error('NBRB API fetch error:', error);
      throw error;
    }
  }

  async getRefinancingRateForDate(
    inputDate: Temporal.PlainDate | Date | string
  ): Promise<RefinancingRateInfo> {
    const date = parseDate(inputDate);
    return this.fetchRefinancingRate(date.toString());
  }
}

export const nbrbService = new NbrbService();