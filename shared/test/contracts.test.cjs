'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
  });
  module._compile(result.outputText, filename);
};
// Exercise current workspace sources, never an older shared/dist build.
const originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === 'jurist-calculator-shared') return require('../src/index.ts');
  return originalLoad.call(this, request, ...args);
};
const api = require('../src/index.ts');
const { createApp } = require('../../server/src/app.ts');
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
function metadata(result) {
  assert.equal(typeof result.rulesVersion, 'string');
  assert.equal(typeof result.methodology.kind, 'string');
  assert.equal(result.methodology.rounding, 'half-up');
  assert.equal(typeof result.referenceData, 'object');
  assert.ok(Array.isArray(result.warnings));
}

test('duty: shared client schema and HTTP preserve court, applicant and calendar date', async () => {
  const request = api.dutyRequestSchema.parse(duty);
  const { status, body } = await post('/api/duty/calculate', request);
  assert.equal(status, 200);
  assert.deepEqual(body, api.calculateDutyRequest(request));
  assert.deepEqual(body.input, duty);
  assert.equal(body.amount, 135);
  assert.equal(body.referenceData.baseValue.selectedOn, duty.date);
  metadata(body);
});
test('duty: scenario fields reach original-claim and administrative tariffs', async () => {
  const scenarios = [
    [{ ...duty, amount: undefined, courtType: 'appellate_economic', caseType: 'appeal', plaintiffType: 'organization', originalCaseType: 'non_property_org', originalCourtLevel: 'economic' }, 720],
    [{ ...duty, amount: undefined, caseType: 'appeal', originalCaseType: 'non_property' }, 108],
    [{ ...duty, amount: undefined, caseType: 'appeal', originalCaseType: 'divorce', isRepeated: true }, 0],
    [{ ...duty, amount: undefined, caseType: 'administrative', administrativePenalty: 'fine', fineAmount: 4500 }, 135],
    [{ ...duty, amount: undefined, caseType: 'administrative', administrativePenalty: 'other' }, 45],
    [{ ...duty, amount: undefined, caseType: 'cassation', originalCaseType: 'administrative', administrativePenalty: 'fine', fineAmount: 450 }, 72],
    [{ ...duty, courtType: 'economic', caseType: 'property_quality', plaintiffType: 'ip', amount: 50000 }, 1920],
  ];
  for (const [request, expected] of scenarios) {
    const { status, body } = await post('/api/duty/calculate', request);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.amount, expected);
    assert.deepEqual(body.input, JSON.parse(JSON.stringify(request)));
  }
});
test('duty: missing conditional fields and invalid enums are rejected before calculation', async () => {
  const invalid = [
    [null, 'request'], [{ ...duty, courtType: 'ip' }, 'courtType'],
    [{ ...duty, plaintiffType: undefined }, 'plaintiffType'], [{ ...duty, date: undefined }, 'date'],
    [{ ...duty, amount: undefined }, 'amount'], [{ ...duty, caseType: 'property_quality' }, 'caseType'],
    [{ ...duty, amount: undefined, caseType: 'appeal' }, 'originalCaseType'],
    [{ ...duty, courtType: 'economic', amount: undefined, caseType: 'appeal', originalCaseType: 'non_property_org' }, 'originalCourtLevel'],
    [{ ...duty, caseType: 'administrative' }, 'administrativePenalty'],
    [{ ...duty, caseType: 'administrative', administrativePenalty: 'fine' }, 'fineAmount'],
    [{ ...duty, caseType: 'non_property', amount: undefined, discountId: 'unused' }, 'discountId'],
  ];
  for (const [request, field] of invalid) {
    const { status, body } = await post('/api/duty/calculate', request);
    assert.equal(status, 400);
    assert.ok(body.issues.some(i => i.path === field), JSON.stringify(body));
  }
});
test('dates: timestamps, local date strings, impossible dates and reversed periods fail shared schemas', () => {
  for (const date of ['2026-02-30', '12.11.2026', '2026-11-12T00:00:00Z', new Date(), null]) {
    assert.throws(() => api.dutyRequestSchema.parse({ ...duty, date }), api.ContractValidationError);
    assert.throws(() => api.penaltyRequestSchema.parse({ ...period, startDate: date, rate: 0.1 }), api.ContractValidationError);
  }
  assert.throws(() => api.penaltyRequestSchema.parse({ ...period, endDate: '2026-04-30', rate: 0.1 }));
});
test('penalty: both endpoints require an explicit rate and preserve zero', async () => {
  for (const endpoint of ['/api/penalty/calculate', '/api/penalty/calculate-multiple']) {
    const request = endpoint.endsWith('multiple') ? { documents: [{ ...period, name: 'Договор' }] } : period;
    for (const options of [{}, { rate: null }, { rate: '' }, { rate: '0' }, { rate: -1 }]) {
      const { status, body } = await post(endpoint, { ...request, ...options });
      assert.equal(status, 400);
      assert.ok(body.issues.some(i => i.path === 'rate'));
    }
    for (const options of [{ rate: 0 }, { rate: 0.1 }]) {
      const { status, body } = await post(endpoint, { ...request, ...options });
      assert.equal(status, 200);
      assert.equal(body.total ?? body.amount, options.rate === 0 ? 0 : 310);
      assert.equal(body.rate, options.rate);
      assert.equal(body.type, 'penalty');
      assert.equal(body.methodology.kind, 'daily');
      assert.equal(body.methodology.dayCount, undefined);
      assert.equal(body.annualRate, undefined);
      metadata(body);
      const row = body.results ? body.results[0] : body;
      assert.equal(row.days, 31);
      assert.equal(row.penalty, row.amount);
      metadata(row);
    }
    for (const annualRate of [0, 10, null]) {
      for (const rate of [undefined, 0, 1]) {
        const { status, body } = await post(endpoint, { ...request, rate, annualRate, dayCount: 360 });
        assert.equal(status, 400);
        assert.ok(body.issues.some(i => i.path === 'annualRate'));
        assert.ok(body.issues.some(i => i.path === 'dayCount'));
      }
    }
    assert.equal((await post(endpoint, { ...request, rate: 0.1, dayCount: 365 })).status, 400);
  }
});
test('daily penalty: services and both endpoints share inclusive days, rounding and exact row aggregation', async () => {
  const documents = [
    { name: ' a ', debt: 1, startDate: '2024-02-29', endDate: '2024-02-29' },
    { name: 'b', debt: 1, startDate: '2024-02-29', endDate: '2024-02-29' },
  ];
  const input = { documents, rate: 0.5 };
  const { status, body } = await post('/api/penalty/calculate-multiple', input);
  assert.equal(status, 200);
  assert.equal(body.total, 0.02);
  assert.deepEqual(body, api.calculatePenaltyMultipleService(input));
  assert.deepEqual(body, api.calculatePenaltyMultipleRequest(input));
  for (const [index, doc] of documents.entries()) {
    const { name, ...period } = doc;
    const single = await post('/api/penalty/calculate', { ...period, rate: input.rate });
    assert.equal(single.status, 200);
    assert.equal(single.body.days, 1);
    assert.equal(single.body.amount, 0.01);
    assert.deepEqual(body.results[index], { ...single.body, name: name.trim() });
    assert.deepEqual(single.body, api.calculatePenaltyService({ ...period, rate: input.rate }));
  }
});
test('Article 366: selected annual day count reaches the core, with exact row aggregation', async () => {
  const documents = [
    { name: 'a', debt: 100000, startDate: '2023-12-31', endDate: '2024-01-02' },
    { name: 'b', debt: 100000, startDate: '2023-12-31', endDate: '2024-01-02' },
  ];
  const input = { documents, ...legal, refinancingRate: 10 };
  const { status, body } = await post('/api/interest/calculate-366-multiple', input);
  assert.equal(status, 200);
  assert.equal(body.total, 164.08);
  assert.equal(body.results[0].interest, 82.04);
  assert.equal(body.methodology.dayCount, 'actual/actual');
  assert.deepEqual(body, api.calculateInterest366MultipleService(input));
});
test('Article 366: both endpoints preserve all legal and methodological options', async () => {
  for (const calculationBasis of ['payment', 'judgment', 'executive-endorsement']) {
    for (const endpoint of ['/api/interest/calculate-366', '/api/interest/calculate-366-multiple']) {
      const options = { ...legal, calculationBasis, refinancingRate: 10, hasPenalty: true, statutoryException: true };
      const request = endpoint.endsWith('multiple') ? { documents: [{ name: 'a', ...period }], ...options } : { ...period, ...options };
      const { status, body } = await post(endpoint, request);
      assert.equal(status, 200);
      const row = body.results ? body.results[0] : body;
      assert.equal(row.interest, 84.93);
      assert.equal(row.calculationBasis, calculationBasis);
      assert.equal(row.rateDate, legal.rateDate);
      assert.equal(row.dayCount, legal.dayCount);
      for (const [key, value] of Object.entries(options)) assert.deepEqual(row.input[key], value);
      assert.equal(row.referenceData.refinancingRate.origin, 'input');
      assert.deepEqual(row.warnings, []);
      metadata(body); metadata(row);
    }
  }
});
test('Article 366: estimate warnings, date-dependent reference snapshots, and zero override survive batch', async () => {
  const documents = [{ name: 'a', ...period }, { name: 'b', ...period, endDate: '2026-06-01' }];
  const options = { calculationBasis: 'estimate', hasPenalty: false, dayCount: 365 };
  const { status, body } = await post('/api/interest/calculate-366-multiple', { documents, ...options });
  assert.equal(status, 200);
  assert.ok(body.warnings.length > 0);
  assert.deepEqual(body.results.map(r => r.referenceData.refinancingRate.selectedOn), ['2026-05-31', '2026-06-01']);
  const zero = await post('/api/interest/calculate-366-multiple', { documents, ...options, refinancingRate: 0 });
  assert.equal(zero.body.total, 0);
});
test('Article 366: conditional inputs are validated at the HTTP boundary', async () => {
  const request = { ...period, ...legal };
  for (const [patch, field] of [
    [{ calculationBasis: undefined }, 'calculationBasis'], [{ rateDate: undefined }, 'rateDate'],
    [{ dayCount: undefined }, 'dayCount'], [{ hasPenalty: undefined }, 'hasPenalty'],
    [{ hasPenalty: 'false' }, 'hasPenalty'], [{ hasPenalty: true }, 'statutoryException'],
    [{ refinancingRate: '10' }, 'refinancingRate'], [{ calculationBasis: 'estimate', startDate: '2025-01-01', dayCount: undefined }, 'dayCount'],
  ]) {
    const { status, body } = await post('/api/interest/calculate-366', { ...request, ...patch });
    assert.equal(status, 400);
    assert.ok(body.issues.some(i => i.path === field), JSON.stringify(body));
  }
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
test('malformed JSON and invalid rate date queries return JSON errors', async () => {
  const response = await fetch(url + '/api/duty/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, 'string');
  const query = await fetch(url + '/api/rates/base-value?date=2026-01-01T00:00:00Z');
  assert.equal(query.status, 400);
});

test('API errors have the same shape for validation, calculation, JSON parsing, size limits and unknown routes', async () => {
  const historical = await fetch(url + '/api/rates/base-value?date=1900-01-01');
  const responses = [
    [await post('/api/penalty/calculate', period), 400],
    [await post('/api/duty/calculate', { ...duty, caseType: 'court_order', amount: 4500 }), 400],
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
  for (const error of [new Error('private details'), new SyntaxError('private details'), null]) {
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
