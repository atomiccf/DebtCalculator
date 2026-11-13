import { CalculationError, getEffectiveRecord, getRefinancingRateInfo, parseDate, today, type DateInput } from 'jurist-calculator-shared';

const NBRB_API = process.env.NBRB_API_URL || 'https://api.nbrb.by/refinancingrate';
const CACHE_TTL = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 256;

export interface RefinancingRateResponse { Date: string; Value: number }
export interface RefinancingRateInfo {
  rate: number;
  /** Effective start date, never the string "fallback". */
  date: string;
  requestedOn: string;
  dateTo?: string;
  supportedThrough?: string;
  source: string;
  version: string;
  act: string;
  verifiedOn?: string;
  fetchedAt?: string;
  fallback: boolean;
  warnings: string[];
}

interface NbrbOptions {
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  apiUrl?: string;
}

function requestedDate(date: DateInput): string {
  const value = parseDate(date).toString();
  if (value > today()) throw new CalculationError('Ставка НБРБ для будущей даты не подтверждена');
  return value;
}

export class NbrbService {
  private readonly cache = new Map<string, { value: RefinancingRateInfo; expiresAt: number }>();
  private readonly request: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly apiUrl: string;

  constructor(options: NbrbOptions = {}) {
    this.request = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL;
    this.apiUrl = options.apiUrl ?? NBRB_API;
  }

  /** Cache only validated live responses, keyed by the requested Minsk calendar date. */
  async fetchRefinancingRate(date?: string): Promise<RefinancingRateInfo> {
    const requestedOn = requestedDate(date ?? today());
    const cached = this.cache.get(requestedOn);
    if (cached && cached.expiresAt > this.now()) return structuredClone(cached.value);
    this.cache.delete(requestedOn);

    const url = new URL(this.apiUrl);
    url.searchParams.set('ondate', requestedOn);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.request(url.toString(), { signal: controller.signal });
      if (!response.ok) throw new Error(`NBRB API error: ${response.status}`);
      const data: unknown = await response.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('Empty or invalid NBRB response');
      const records = data.map((item: unknown) => {
        if (!item || typeof item !== 'object' || !('Value' in item) || !('Date' in item)
          || typeof item.Value !== 'number' || !Number.isFinite(item.Value) || item.Value < 0
          || typeof item.Date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.0+)?Z?)?$/.test(item.Date)) {
          throw new Error('Invalid NBRB rate record');
        }
        return { value: item.Value, dateFrom: parseDate(item.Date.slice(0, 10)).toString() };
      });
      // Do not trust response order or select a rate effective after the requested date.
      const record = getEffectiveRecord(records, requestedOn);
      const next = records.filter(r => r.dateFrom > record.dateFrom).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))[0];
      const fetchedAt = new Date(this.now()).toISOString();
      const value: RefinancingRateInfo = {
        rate: record.value, date: record.dateFrom, requestedOn,
        ...(next ? { dateTo: parseDate(next.dateFrom).subtract({ days: 1 }).toString() } : {}),
        source: url.toString(), version: `nbrb-api:${fetchedAt}`, fetchedAt,
        act: 'API Национального банка Республики Беларусь', fallback: false, warnings: [],
      };
      for (const [key, entry] of this.cache) if (entry.expiresAt <= this.now()) this.cache.delete(key);
      if (this.cache.size >= MAX_CACHE_ENTRIES) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(requestedOn, { value, expiresAt: this.now() + this.cacheTtlMs });
      return structuredClone(value);
    } finally {
      clearTimeout(timer);
    }
  }

  /** A fallback always comes from a record covering the same requested date. */
  async getRefinancingRateForDate(inputDate: DateInput): Promise<RefinancingRateInfo> {
    const requestedOn = requestedDate(inputDate);
    try { return await this.fetchRefinancingRate(requestedOn); }
    catch {
      const record = getRefinancingRateInfo(requestedOn);
      return { rate: record.value, date: record.dateFrom, requestedOn,
        dateTo: record.dateTo, supportedThrough: record.supportedThrough,
        source: record.source!, version: record.version!, act: record.act, verifiedOn: record.verifiedOn,
        fallback: true, warnings: ['НБРБ недоступен или вернул некорректный ответ; использован встроенный резервный справочник.'] };
    }
  }
}

export const nbrbService = new NbrbService();
