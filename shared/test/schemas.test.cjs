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
