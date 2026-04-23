import { Temporal } from '@js-temporal/polyfill';

const NBRB_API = 'https://api.nbrb.by/refinancingrate';

export interface RefinancingRateResponse {
  Date: string;
  Value: number;
}

let rateCache: { rate: number; date: string; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

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

export async function fetchRefinancingRate(date?: string): Promise<{ rate: number; date: string }> {
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

export async function getRefinancingRateForDate(
  inputDate: Temporal.PlainDate | Date | string
): Promise<{ rate: number; date: string }> {
  const date = parseDate(inputDate);
  return fetchRefinancingRate(date.toString());
}