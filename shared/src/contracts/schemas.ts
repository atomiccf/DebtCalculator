import { parseDate, parsePeriod } from '../utils/dateUtils';
import { assertPositiveMoney } from '../utils/money';
import { validateDutyRequirements } from '../calculate/dutyRequirements';
import { getDutyRulesInfo } from '../calculate/dutyEditions';
import type { DutyRequest, PenaltyRequest, PenaltyMultipleRequest, Interest366Request, Interest366MultipleRequest, ValidationIssue } from './types';

export class ContractValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(issues.map(i => `${i.path}: ${i.message}`).join('; '));
    this.name = 'ContractValidationError';
  }
}
export interface RequestSchema<T> { parse(value: unknown): T }
const dayCounts = [360, 365, 366, 'start-year', 'end-year', 'actual/actual'];

class Check {
  issues: ValidationIssue[] = [];
  add(path: string, message: string) { this.issues.push({ path, message }); }
  object(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { this.add(path, 'Ожидается объект'); return {}; }
    return value as Record<string, unknown>;
  }
  keys(v: Record<string, unknown>, allowed: readonly string[], path = '') {
    for (const key of Object.keys(v)) if (!allowed.includes(key)) this.add(path ? `${path}.${key}` : key, 'Неизвестное поле');
  }
  one(value: unknown, choices: readonly unknown[], path: string) {
    if (!choices.includes(value)) this.add(path, `Выберите значение: ${choices.join(', ')}`);
  }
  date(value: unknown, path: string) {
    try { if (typeof value !== 'string') throw new Error(); parseDate(value); }
    catch { this.add(path, 'Укажите существующую дату в формате YYYY-MM-DD'); }
  }
  money(value: unknown, path: string) {
    try { assertPositiveMoney(value); } catch { this.add(path, 'Укажите положительную сумму BYN с точностью до копеек'); }
  }
  rate(value: unknown, path: string) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) this.add(path, 'Укажите конечную неотрицательную ставку');
  }
  bool(value: unknown, path: string) { if (typeof value !== 'boolean') this.add(path, 'Укажите логическое значение'); }
  period(v: Record<string, unknown>, prefix = '') {
    const path = (key: string) => prefix ? `${prefix}.${key}` : key;
    this.money(v.debt, path('debt'));
    const before = this.issues.length;
    this.date(v.startDate, path('startDate')); this.date(v.endDate, path('endDate'));
    if (before === this.issues.length) {
      try { parsePeriod(v.startDate as string, v.endDate as string); }
      catch { this.add(path('endDate'), 'Дата окончания раньше даты начала'); }
    }
  }
  documents(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value) || !value.length) { this.add('documents', 'Необходим непустой список документов'); return []; }
    return value.map((doc, index) => {
      const prefix = `documents.${index}`;
      const v = this.object(doc, prefix);
      this.keys(v, ['name', 'debt', 'startDate', 'endDate'], prefix);
      if (typeof v.name !== 'string' || !v.name.trim()) this.add(`${prefix}.name`, 'Укажите название документа');
      this.period(v, prefix);
      return v;
    });
  }
  finish<T>(value: unknown): T {
    if (this.issues.length) throw new ContractValidationError(this.issues);
    return value as T;
  }
}

export const dutyRequestSchema: RequestSchema<DutyRequest> = { parse(value) {
  const c = new Check(); const v = c.object(value, 'request');
  const common = v.courtType === 'common';
  c.keys(v, ['courtType', 'caseType', 'plaintiffType', 'amount', 'date', 'originalCaseType', ...(common ? ['isRepeated', 'administrativePenalty', 'fineAmount'] : ['originalCourtLevel'])]);
  c.issues.push(...validateDutyRequirements({ ...v, courtType: v.courtType, caseType: v.caseType, plaintiffType: v.plaintiffType }));
  c.date(v.date, 'date');
  if (!c.issues.some(i => i.path === 'date')) {
    try { getDutyRulesInfo(v.date as string); }
    catch (error) { c.add('date', (error as Error).message); }
  }
  return c.finish<DutyRequest>(v);
} };

const periodKeys = ['debt', 'startDate', 'endDate'];
export const calendarDateSchema: RequestSchema<string> = { parse(value) {
  const c = new Check(); c.date(value, 'date'); return c.finish<string>(value);
} };
const penaltyKeys = ['rate'];
function penaltyCheck(c: Check, v: Record<string, unknown>) {
  if (typeof v.rate !== 'number' || !Number.isFinite(v.rate) || v.rate <= 0) c.add('rate', 'введите корректный размер пени');
}
export const penaltyRequestSchema: RequestSchema<PenaltyRequest> = { parse(value) {
  const c = new Check(); const v = c.object(value, 'request');
  c.keys(v, [...periodKeys, ...penaltyKeys]); c.period(v); penaltyCheck(c, v);
  return c.finish<PenaltyRequest>(v);
} };
export const penaltyMultipleRequestSchema: RequestSchema<PenaltyMultipleRequest> = { parse(value) {
  const c = new Check(); const v = c.object(value, 'request');
  c.keys(v, ['documents', ...penaltyKeys]); c.documents(v.documents); penaltyCheck(c, v);
  return c.finish<PenaltyMultipleRequest>(v);
} };

const interestKeys = ['calculationBasis', 'rateDate', 'dayCount', 'hasPenalty', 'statutoryException', 'refinancingRate'];
function interestCheck(c: Check, v: Record<string, unknown>, periods: Record<string, unknown>[]) {
  c.one(v.calculationBasis, ['payment', 'judgment', 'executive-endorsement', 'estimate'], 'calculationBasis');
  c.bool(v.hasPenalty, 'hasPenalty');
  if (v.statutoryException !== undefined) c.bool(v.statutoryException, 'statutoryException');
  if (v.hasPenalty === true && v.statutoryException !== true) c.add('statutoryException', 'При наличии неустойки требуется законодательное исключение');
  if (v.refinancingRate !== undefined) c.rate(v.refinancingRate, 'refinancingRate');
  if (v.rateDate !== undefined || v.calculationBasis !== 'estimate') c.date(v.rateDate, 'rateDate');
  const multiYear = periods.some(p => typeof p.startDate === 'string' && typeof p.endDate === 'string' && p.startDate.slice(0, 4) !== p.endDate.slice(0, 4));
  if (v.dayCount !== undefined || v.calculationBasis !== 'estimate' || multiYear) c.one(v.dayCount, dayCounts, 'dayCount');
}
export const interest366RequestSchema: RequestSchema<Interest366Request> = { parse(value) {
  const c = new Check(); const v = c.object(value, 'request');
  c.keys(v, [...periodKeys, ...interestKeys]); c.period(v); interestCheck(c, v, [v]);
  return c.finish<Interest366Request>(v);
} };
export const interest366MultipleRequestSchema: RequestSchema<Interest366MultipleRequest> = { parse(value) {
  const c = new Check(); const v = c.object(value, 'request');
  c.keys(v, ['documents', ...interestKeys]); const docs = c.documents(v.documents); interestCheck(c, v, docs);
  return c.finish<Interest366MultipleRequest>(v);
} };
