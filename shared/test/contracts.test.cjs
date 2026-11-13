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
const app = require('../../server/src/index.ts').default;
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
    assert.equal((await post(endpoint, request)).status, 400);
    for (const options of [{ rate: 0 }, { annualRate: 0, dayCount: 360 }]) {
      const { status, body } = await post(endpoint, { ...request, ...options });
      assert.equal(status, 200);
      assert.equal(body.total ?? body.amount, 0);
      assert.equal(body.rate, 0);
      metadata(body);
      if (body.results) metadata(body.results[0]);
    }
    assert.equal((await post(endpoint, { ...request, annualRate: 10 })).status, 400);
    assert.equal((await post(endpoint, { ...request, rate: 1, annualRate: 10, dayCount: 360 })).status, 400);
  }
});
test('annual penalty: selected day count reaches the core, with exact row aggregation', async () => {
  const documents = [
    { name: 'a', debt: 100000, startDate: '2023-12-31', endDate: '2024-01-02' },
    { name: 'b', debt: 100000, startDate: '2023-12-31', endDate: '2024-01-02' },
  ];
  const { body } = await post('/api/penalty/calculate-multiple', { documents, annualRate: 10, dayCount: 'actual/actual' });
  assert.equal(body.total, 164.08);
  assert.equal(body.results[0].amount, 82.04);
  assert.equal(body.methodology.dayCount, 'actual/actual');
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
