'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/register.cjs');

const api = require('../src/index.ts');
const { createApp } = require('../../server/src/app.ts');
const { nbrbService } = require('../../server/src/services/nbrbService.ts');
const { errorHandler } = require('../../server/src/middleware/errors.ts');
const app = createApp();
const period = { debt: 10000, startDate: '2026-05-01', endDate: '2026-05-31' };
const legal = { calculationBasis: 'judgment', rateDate: '2026-06-01', dayCount: 'actual/actual', hasPenalty: false };
const duty = { courtType: 'common', caseType: 'property', plaintiffType: 'individual', amount: 1000, date: '2026-11-12' };
let server, url;
test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await new Promise(resolve => server.close(resolve)); });
async function post(endpoint, body) {
  const response = await fetch(url + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
test('duty HTTP returns the calculation, original input and selected edition metadata', async () => {
  const { status, body } = await post('/api/duty/calculate', duty);
  assert.equal(status, 200);
  assert.equal(body.amount, 135);
  assert.deepEqual(body.input, duty);
  assert.equal(body.referenceData.baseValue.selectedOn, duty.date);
  assert.equal(body.referenceData.baseValue.record.value, 45);
  assert.equal(body.rules.version, body.rulesVersion);
  assert.equal(body.rules.dateFrom, '2026-07-01');
});

test('duty: scenario fields reach original-claim and administrative tariffs', async () => {
  const scenarios = [
    [{ ...duty, amount: undefined, courtType: 'appellate_economic', caseType: 'appeal', plaintiffType: 'organization', originalCaseType: 'non_property_org', originalCourtLevel: 'economic' }, 720],
    [{ ...duty, amount: undefined, caseType: 'divorce', isRepeated: true }, 360],
    [{ ...duty, amount: undefined, caseType: 'administrative', administrativePenalty: 'fine', fineAmount: 4500 }, 135],
    [{ ...duty, courtType: 'economic', caseType: 'property_quality', plaintiffType: 'ip', amount: 50000 }, 1920],
  ];
  for (const [request, expected] of scenarios) {
    const { status, body } = await post('/api/duty/calculate', request);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.amount, expected);
    assert.deepEqual(body.input, JSON.parse(JSON.stringify(request)));
  }
});
test('both daily penalty endpoints preserve an explicitly entered zero rate', async () => {
  for (const endpoint of ['/api/penalty/calculate', '/api/penalty/calculate-multiple']) {
    const request = endpoint.endsWith('multiple') ? { documents: [{ ...period, name: 'Contract' }], rate: 0 } : { ...period, rate: 0 };
    const { status, body } = await post(endpoint, request);
    assert.equal(status, 200);
    assert.equal(body.total ?? body.amount, 0);
    assert.equal(body.rate, 0);
  }
});

test('daily HTTP endpoints forward document debts, periods and the common rate', async () => {
  const single = await post('/api/penalty/calculate', { ...period, rate: 0.1 });
  assert.equal(single.status, 200);
  assert.equal(single.body.days, 31);
  assert.equal(single.body.penalty, 310);
  const multiple = await post('/api/penalty/calculate-multiple', { rate: 0.1, documents: [
    { name: 'Invoice A', ...period, debt: 1000 },
    { name: 'Invoice B', debt: 2000, startDate: '2026-05-31', endDate: '2026-05-31' },
  ] });
  assert.equal(multiple.status, 200);
  assert.deepEqual(multiple.body.results.map(r => [r.name, r.days, r.penalty]), [['Invoice A', 31, 31], ['Invoice B', 1, 2]]);
  assert.equal(multiple.body.total, 33);
});

test('both Article 366 endpoints forward legal context, explicit rate and annual day count', async () => {
  for (const [endpoint, calculationBasis] of [
    ['/api/interest/calculate-366', 'payment'],
    ['/api/interest/calculate-366-multiple', 'executive-endorsement'],
  ]) {
    const options = { ...legal, calculationBasis, refinancingRate: 10, hasPenalty: true, statutoryException: true };
    const request = endpoint.endsWith('multiple') ? { documents: [{ name: 'Contract', ...period }], ...options } : { ...period, ...options };
    const { status, body } = await post(endpoint, request);
    assert.equal(status, 200);
    const row = body.results ? body.results[0] : body;
    assert.equal(row.interest, 84.93);
    assert.equal(row.calculationBasis, calculationBasis);
    assert.equal(row.rateDate, '2026-06-01');
    assert.equal(row.dayCount, 'actual/actual');
    for (const [key, value] of Object.entries(options)) assert.deepEqual(row.input[key], value);
    assert.equal(row.referenceData.refinancingRate.origin, 'input');
    assert.deepEqual(row.warnings, []);
  }
});

test('Article 366 batch HTTP exposes estimate warnings and each document rate', async () => {
  const documents = [{ name: 'May', ...period }, { name: 'June', ...period, endDate: '2026-06-01' }];
  const { status, body } = await post('/api/interest/calculate-366-multiple', {
    documents, calculationBasis: 'estimate', hasPenalty: false, dayCount: 365,
  });
  assert.equal(status, 200);
  assert.ok(body.warnings.some(w => w.includes('Предварительный')));
  assert.deepEqual(body.results.map(r => r.refinancingRate), [9.75, 9.25]);
  assert.deepEqual(body.results.map(r => r.referenceData.refinancingRate.selectedOn), ['2026-05-31', '2026-06-01']);
});

test('batch validation reports document paths and rejects the whole request', async () => {
  for (const endpoint of ['/api/penalty/calculate-multiple', '/api/interest/calculate-366-multiple']) {
    const options = endpoint.includes('interest') ? legal : { rate: 0.1 };
    const { status, body } = await post(endpoint, { documents: [{ name: 'ok', ...period }, { name: 'bad', ...period, debt: '100' }], ...options });
    assert.equal(status, 400);
    assert.ok(body.issues.some(i => i.path === 'documents.1.debt'));
    assert.equal(body.results, undefined);
  }
});
test('API errors have the same shape for validation, calculation, JSON parsing, size limits and unknown routes', async () => {
  const historical = await fetch(url + '/api/rates/base-value?date=2018-12-31');
  const responses = [
    [await post('/api/penalty/calculate', period), 400],
    [await post('/api/duty/calculate', { ...duty, courtType: 'supreme_economic', caseType: 'fact_establishment', amount: undefined }), 400],
    [{ status: historical.status, body: await historical.json() }, 400],
  ];
  for (const [body, status] of [['{', 400], ['null', 400], ['"' + 'a'.repeat(110000) + '"', 413]]) {
    const response = await fetch(url + '/api/penalty/calculate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    responses.push([{ status: response.status, body: await response.json() }, status]);
  }
  const missing = await fetch(url + '/api/missing');
  responses.push([{ status: missing.status, body: await missing.json() }, 404]);
  for (const [response, status] of responses) {
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(response.body).sort(), ['error', 'issues']);
    assert.equal(typeof response.body.error, 'string');
    assert.ok(response.body.issues.length > 0);
    for (const issue of response.body.issues) {
      assert.equal(typeof issue.path, 'string');
      assert.equal(typeof issue.message, 'string');
    }
  }
});

test('unexpected failures, including internal SyntaxError, return 500 without exposing details', () => {
  for (const error of [new Error('private details'), new SyntaxError('private details')]) {
    const res = {
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
    };
    errorHandler(error, {}, res, () => assert.fail('unexpected next'));
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      error: 'Внутренняя ошибка сервера',
      issues: [{ path: 'request', message: 'Внутренняя ошибка сервера' }],
    });
  }
});

test('reference HTTP endpoints honor the requested date and mark dated fallback data', async t => {
  t.mock.method(nbrbService, 'fetchRefinancingRate', async () => { throw new Error('offline'); });
  for (const endpoint of ['/api/rates/refinancing', '/api/rates/current']) {
    const response = await fetch(url + endpoint + '?date=2026-05-31');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.fallback, true);
    assert.ok(body.warnings.length > 0);
    if (endpoint.endsWith('current')) {
      assert.equal(body.refinancingRate, 9.75);
      assert.equal(body.refinancingRateDate, '2025-06-25');
      assert.equal(body.referenceData.baseValue.selectedOn, '2026-05-31');
      assert.equal(body.referenceData.refinancingRate.requestedOn, '2026-05-31');
    } else {
      assert.equal(body.value, 9.75);
      assert.equal(body.date, '2025-06-25');
      assert.equal(body.requestedOn, '2026-05-31');
    }
  }
});

test('reference HTTP endpoints report invalid and uncovered dates as JSON errors', async t => {
  t.mock.method(nbrbService, 'fetchRefinancingRate', async () => { throw new Error('offline'); });
  for (const endpoint of ['/api/rates/base-value', '/api/rates/refinancing', '/api/rates/current']) {
    for (const date of ['2026-06-01T00:00:00Z', '1999-12-20']) {
      const response = await fetch(url + endpoint + '?date=' + date);
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.ok(body.issues.length > 0);
    }
  }
});
