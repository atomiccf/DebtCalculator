'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/register.cjs');
const api = require('../src/index.ts');

const period = { debt: 10000, startDate: '2026-05-01', endDate: '2026-05-31' };
const duty = { courtType: 'common', caseType: 'property', plaintiffType: 'individual', amount: 1000, date: '2026-11-13' };
const legal = { calculationBasis: 'judgment', rateDate: '2026-06-01', dayCount: 'actual/actual', hasPenalty: false };

function rejects(schema, request, path) {
  assert.throws(() => schema.parse(request), error =>
    error instanceof api.ContractValidationError && error.issues.some(issue => issue.path === path), path);
}

function calculateDutyCore(request) {
  const { courtType, amount, date, ...config } = request;
  return courtType === 'common'
    ? api.calculateCommonCourtDutyWithBaseValue(config, 45, amount)
    : api.calculateEconomicCourtDutyWithBaseValue({ ...config, courtLevel: courtType }, 45, amount);
}

test('transport dates must be calendar strings and periods must run forwards', () => {
  for (const startDate of ['2026-02-30', '01.05.2026', '2026-05-01T00:00:00Z', new Date('2026-05-01'), null]) {
    rejects(api.penaltyRequestSchema, { ...period, rate: 0.1, startDate }, 'startDate');
  }
  rejects(api.penaltyRequestSchema, { ...period, rate: 0.1, endDate: '2026-04-30' }, 'endDate');
});

test('duty requires the fields that determine its tariff', () => {
  const invalid = [
    [null, 'request'], [{ ...duty, courtType: 'ip' }, 'courtType'],
    [{ ...duty, plaintiffType: undefined }, 'plaintiffType'], [{ ...duty, date: undefined }, 'date'],
    [{ ...duty, amount: undefined }, 'amount'], [{ ...duty, caseType: 'property_quality' }, 'caseType'],
    [{ ...duty, amount: undefined, caseType: 'appeal' }, 'originalCaseType'],
    [{ ...duty, courtType: 'economic', amount: undefined, caseType: 'appeal', originalCaseType: 'non_property_org' }, 'originalCourtLevel'],
    [{ ...duty, amount: undefined, caseType: 'administrative' }, 'administrativePenalty'],
    [{ ...duty, amount: undefined, caseType: 'administrative', administrativePenalty: 'fine' }, 'fineAmount'],
    [{ ...duty, courtType: 'economic', caseType: 'non_property_ip', plaintiffType: 'organization', amount: undefined }, 'plaintiffType'],
    [{ ...duty, discountId: 'unused' }, 'discountId'],
  ];
  for (const [request, field] of invalid) rejects(api.dutyRequestSchema, request, field);
});

test('duty schema and direct calculation reject the same unsupported scenario facts', () => {
  const original = { ...duty, caseType: 'cassation', amount: undefined };
  const economic = { ...original, courtType: 'economic', plaintiffType: 'organization' };
  const invalid = [
    [{ ...duty, plaintiffType: 'ip' }, 'plaintiffType'],
    [{ ...duty, amount: undefined }, 'amount'],
    [{ ...duty, courtType: 'economic', caseType: 'property_quality', amount: undefined }, 'amount'],
    [{ ...duty, caseType: 'court_order', amount: undefined }, 'amount'],
    [{ ...duty, courtType: 'supreme_economic', caseType: 'fact_establishment' }, 'caseType'],
    [{ ...duty, courtType: 'economic', caseType: 'non_property_ip' }, 'plaintiffType'],
    [original, 'originalCaseType'],
    [{ ...original, originalCaseType: 'appeal' }, 'originalCaseType'],
    [{ ...original, originalCaseType: 'unknown' }, 'originalCaseType'],
    [{ ...original, originalCaseType: 'property' }, 'amount'],
    [{ ...original, originalCaseType: 'alimony' }, 'originalCaseType'],
    [{ ...original, caseType: 'appeal', originalCaseType: 'alimony', plaintiffType: 'organization' }, 'originalCaseType'],
    [{ ...economic, originalCaseType: 'non_property_org' }, 'originalCourtLevel'],
    [{ ...economic, originalCaseType: 'non_property_ip', originalCourtLevel: 'economic' }, 'plaintiffType'],
    [{ ...economic, originalCaseType: 'fact_establishment', originalCourtLevel: 'supreme_economic' }, 'originalCourtLevel'],
    [{ ...economic, originalCaseType: 'subsidiary', originalCourtLevel: 'common' }, 'originalCourtLevel'],
    [{ ...duty, caseType: 'divorce', isRepeated: 'true' }, 'isRepeated'],
    [{ ...original, originalCaseType: 'administrative' }, 'administrativePenalty'],
    [{ ...original, originalCaseType: 'administrative', administrativePenalty: 'fine' }, 'fineAmount'],
  ];
  for (const [request, path] of invalid) {
    rejects(api.dutyRequestSchema, request, path);
    assert.throws(() => calculateDutyCore(request), api.CalculationError, JSON.stringify(request));
  }
});

test('original court and additional facts preserve supported tariffs at both boundaries', () => {
  const original = { ...duty, caseType: 'appeal', amount: undefined };
  const economic = { ...original, courtType: 'supreme_economic', plaintiffType: 'organization' };
  for (const [request, expected] of [
    [{ ...economic, originalCaseType: 'fact_establishment', originalCourtLevel: 'economic' }, 360],
    [{ ...economic, originalCaseType: 'fact_establishment', originalCourtLevel: 'appellate_economic' }, 540],
    [{ ...economic, originalCaseType: 'subsidiary' }, 900],
    [{ ...original, originalCaseType: 'alimony' }, 0],
    [{ ...original, originalCaseType: 'divorce', isRepeated: true, plaintiffType: 'organization' }, 288],
    [{ ...original, originalCaseType: 'administrative', administrativePenalty: 'fine', fineAmount: 100 }, 18],
    [{ ...original, originalCaseType: 'administrative', administrativePenalty: 'other' }, 36],
  ]) {
    assert.deepEqual(api.dutyRequestSchema.parse(request), request);
    assert.equal(calculateDutyCore(request), expected);
  }
});

test('daily penalty requires an explicit numeric rate and rejects annual calculation fields', () => {
  for (const [schema, request] of [
    [api.penaltyRequestSchema, period],
    [api.penaltyMultipleRequestSchema, { documents: [{ name: 'Договор', ...period }] }],
  ]) {
    for (const rate of [undefined, null, '', '0', 0, -1]) rejects(schema, { ...request, rate }, 'rate');
    assert.doesNotThrow(() => schema.parse({ ...request, rate: 0.0001 }));
    // Each forbidden field is independent; the value of rate does not change that rule.
    rejects(schema, { ...request, rate: 0.1, annualRate: 10 }, 'annualRate');
    rejects(schema, { ...request, rate: 0.1, dayCount: 365 }, 'dayCount');
  }
});

test('Article 366 requires the event date, day-count choice and penalty context', () => {
  for (const [patch, field] of [
    [{ calculationBasis: undefined }, 'calculationBasis'], [{ rateDate: undefined }, 'rateDate'],
    [{ dayCount: undefined }, 'dayCount'], [{ hasPenalty: undefined }, 'hasPenalty'],
    [{ hasPenalty: 'false' }, 'hasPenalty'], [{ hasPenalty: true }, 'statutoryException'],
    [{ refinancingRate: '10' }, 'refinancingRate'],
    [{ calculationBasis: 'estimate', startDate: '2025-12-31', dayCount: undefined }, 'dayCount'],
  ]) rejects(api.interest366RequestSchema, { ...period, ...legal, ...patch }, field);
  assert.doesNotThrow(() => api.interest366RequestSchema.parse({ ...period, ...legal, hasPenalty: true, statutoryException: true }));
  assert.doesNotThrow(() => api.interest366RequestSchema.parse({ ...period, calculationBasis: 'estimate', hasPenalty: false }));
});

test('batch validation rejects empty documents, blank names and invalid money with row paths', () => {
  for (const [schema, options] of [
    [api.penaltyMultipleRequestSchema, { rate: 0.1 }],
    [api.interest366MultipleRequestSchema, legal],
  ]) {
    rejects(schema, { documents: [], ...options }, 'documents');
    rejects(schema, { documents: [{ name: ' ', ...period }], ...options }, 'documents.0.name');
    for (const debt of ['100', 0, -1, 1.001]) {
      rejects(schema, { documents: [{ name: 'Верный', ...period }, { name: 'Ошибка', ...period, debt }], ...options }, 'documents.1.debt');
    }
  }
});
