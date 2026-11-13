'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/register.cjs');
const api = require('../src/index.ts');
const { NbrbService } = require('../../server/src/services/nbrbService.ts');
const { CalculationDetails } = require('../../client/src/components/ui/CalculationDetails.tsx');
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const editions = require('../src/calculate/dutyEditions.ts');
const { dutyUnits } = require('../src/calculate/dutyRules.ts');
const { DUTY_EDITION_2026 } = require('../src/calculate/rules2026.ts');
const duty = { courtType: 'common', caseType: 'property', plaintiffType: 'individual', amount: 1000, date: '2026-11-13' };
const interest = { debt: 36500, startDate: '2026-05-01', endDate: '2026-05-31',
  calculationBasis: 'payment', rateDate: '2026-06-01', dayCount: 365, hasPenalty: false };
const json = data => ({ ok: true, json: async () => data });
const row = (Date, Value) => ({ Date, Value });

function displayed(calculation, texts) {
  const html = renderToStaticMarkup(createElement(CalculationDetails, { calculation }));
  for (const text of texts) assert.ok(html.includes(text), text);
}

test('duty result and display use the actual 2026 base-value record', () => {
  const result = api.calculateDutyService(duty);
  assert.equal(result.amount, 135); // Minimum of 3 BV at 45 BYN.
  assert.equal(result.baseValue, 45);
  const { selectedOn, record } = result.referenceData.baseValue;
  assert.equal(selectedOn, '2026-11-13');
  assert.equal(record.value, 45);
  assert.equal(record.dateFrom, '2026-01-01');
  assert.equal(record.source, 'https://nalog.gov.by/news/33270/');
  assert.equal(result.rules.version, result.rulesVersion);
  displayed(result, ['45 BYN', '2026-01-01', record.act, record.source, record.version, result.rulesVersion]);
});

test('Article 366 uses the rate on the event date in the calculation and display', () => {
  // The period ends before the actual change from 9.75% to 9.25% on June 1.
  const result = api.calculateInterest366Service(interest);
  assert.equal(result.interest, 286.75); // 36500 * 9.25 / 100 * 31 / 365.
  assert.equal(result.refinancingRate, 9.25);
  const reference = result.referenceData.refinancingRate;
  assert.equal(reference.value, 9.25);
  assert.equal(reference.selectedOn, '2026-06-01');
  assert.equal(reference.dateFrom, '2026-06-01');
  assert.equal(reference.source, 'https://nalog.gov.by/reference/penalty_rate/');
  displayed(result, ['9.25%', '2026-06-01', reference.source, reference.version, result.rulesVersion]);
});

test('explicit zero annual rate overrides the reference and is identified as user input', () => {
  const result = api.calculateInterest366Service({ ...interest, refinancingRate: 0 });
  assert.equal(result.interest, 0);
  assert.equal(result.refinancingRate, 0);
  const reference = result.referenceData.refinancingRate;
  assert.equal(reference.origin, 'input');
  assert.equal(reference.source, 'user-input');
  assert.equal(reference.dateFrom, null);
  assert.equal(reference.dateTo, null);
  assert.equal(reference.record, undefined);
  displayed(result, ['0%']);
});

test('estimate batches preserve different rates and intervals across the actual June rate change', () => {
  const result = api.calculateInterest366MultipleService({ calculationBasis: 'estimate', hasPenalty: false, dayCount: 365,
    documents: ['2026-05-31', '2026-06-01'].map((endDate, i) => ({ name: String(i), debt: 36500, startDate: '2026-05-01', endDate })) });
  assert.deepEqual(result.results.map(r => r.refinancingRate), [9.75, 9.25]);
  assert.deepEqual(result.results.map(r => r.referenceData.refinancingRate.dateFrom), ['2025-06-25', '2026-06-01']);
  assert.equal(result.results[0].referenceData.refinancingRate.dateTo, '2026-05-31');
  assert.deepEqual(result.results.map(r => r.interest), [302.25, 296]);
  assert.equal(result.total, 598.25);
  assert.ok(result.results.every(r => r.rules.version === result.rulesVersion));
  assert.deepEqual(result.referenceData, {});
});

test('batches sum rounded rows and daily provenance preserves each document period', () => {
  const documents = [
    { name: ' a ', debt: 1, startDate: '2026-01-01', endDate: '2026-01-01' },
    { name: 'b', debt: 1, startDate: '2026-02-01', endDate: '2026-02-01' },
  ];
  const daily = api.calculatePenaltyMultipleRequest({ rate: 0.5, documents });
  // Each row accrues half a kopeck and rounds to 0.01; the result must be 0.02.
  assert.equal(daily.total, 0.02);
  assert.deepEqual(daily.results.map(r => [r.name, r.days, r.amount]), [['a', 1, 0.01], ['b', 1, 0.01]]);
  assert.deepEqual(daily.referenceData, {});
  for (const r of daily.results) {
    assert.equal(r.referenceData.dailyRate.dateFrom, r.startDate);
    assert.equal(r.referenceData.dailyRate.dateTo, r.endDate);
    assert.equal(r.referenceData.dailyRate.value, 0.5);
    assert.equal(r.rules.version, r.rulesVersion);
  }
  const annual = api.calculateInterest366MultipleRequest({ calculationBasis: 'payment', rateDate: '2026-06-01',
    dayCount: 365, hasPenalty: false, refinancingRate: 5,
    documents: documents.map(doc => ({ ...doc, debt: 36.5 })) });
  assert.deepEqual(annual.results.map(r => r.interest), [0.01, 0.01]); // 36.5 * 5% / 365 = 0.005.
  assert.equal(annual.total, 0.02);
});

test('published tariff coverage accepts its boundaries and rejects adjacent unsupported dates', () => {
  for (const date of ['2026-07-01', '2026-12-31']) {
    const result = api.calculateDutyRequest({ ...duty, date });
    assert.equal(result.amount, 135);
    assert.equal(result.rules.dateFrom, '2026-07-01');
    assert.equal(result.rules.dateTo, '2026-12-31');
  }
  for (const date of ['2026-06-30', '2027-01-01']) {
    assert.throws(() => api.calculateDutyRequest({ ...duty, date }), api.ContractValidationError);
  }
  assert.throws(() => api.calculateDutyService({ ...duty, date: '2026-06-30' }), api.CalculationError);
  assert.throws(() => api.calculateCommonCourtDuty(duty, 1000, '2027-01-01'), api.CalculationError);
});

// Synthetic edition tests dispatch only; this does not add unreviewed tariffs to production.
function editionFixtures(calculateUnits) {
  return [
    { ...DUTY_EDITION_2026, rules: { ...DUTY_EDITION_2026.rules, dateTo: '2026-11-13' } },
    { rules: { ...DUTY_EDITION_2026.rules, version: 'test-only-next-edition',
      source: 'test-fixture', dateFrom: '2026-11-14' }, calculateUnits },
  ];
}

test('edition selection binds dates and saved versions to the full implementation', () => {
  let received;
  const history = editionFixtures((config, baseValue, amount) => {
    received = { config, baseValue, amount };
    return 1005000n; // 1.005 BYN, rounded only by the common boundary.
  });
  const config = { caseType: 'property', plaintiffType: 'individual' };
  for (const [date, version, expected] of [
    ['2026-11-13', api.DUTY_RULES_2026.version, 135],
    ['2026-11-14', 'test-only-next-edition', 1.01],
    ['2026-12-31', 'test-only-next-edition', 1.01],
  ]) {
    const edition = api.getDutyEdition(date, history);
    assert.equal(edition.rules.version, version);
    assert.equal(editions.getDutyEditionByVersion(version, history), edition);
    assert.equal(api.fromDutyUnits(dutyUnits(config, 45, 1000.50, edition)), expected);
  }
  assert.deepEqual(received, { config, baseValue: 45000000n, amount: 1000500000n });
  // Selecting a new implementation does not mutate the older edition or its output.
  assert.equal(api.calculateDutyWithRules(config, 45, JSON.parse(JSON.stringify(api.DUTY_RULES_2026)), 1000.50), 135);
  assert.equal(api.DUTY_RULES_2026.dateTo, '2026-12-31');
  for (const date of ['2026-06-30', '2027-01-01']) assert.throws(() => api.getDutyEdition(date, history), api.CalculationError);
  const gap = [history[0], { ...history[1], rules: { ...history[1].rules, dateFrom: '2026-11-15' } }];
  assert.throws(() => api.getDutyEdition('2026-11-14', gap), api.CalculationError);
  assert.throws(() => api.getDutyEdition('2026-02-30', history));
  assert.throws(() => api.calculateDutyWithRules(config, 45, { ...api.DUTY_RULES_2026, version: 'unknown' }, 1000.50), api.CalculationError);
});

test('dated wrappers and services execute the selected edition and retain serializable metadata', t => {
  const history = editionFixtures(() => 1005000n);
  const byVersion = editions.getDutyEditionByVersion;
  t.mock.method(editions, 'getDutyRulesInfo', date => api.getDutyEdition(date, history).rules);
  t.mock.method(editions, 'getDutyEditionByVersion', version => byVersion(version, history));
  const scenarios = [
    [duty, 135],
    [{ ...duty, caseType: 'non_property', amount: undefined }, 135],
    [{ ...duty, caseType: 'appeal' }, 108],
    [{ ...duty, caseType: 'cassation', amount: undefined, originalCaseType: 'non_property' }, 108],
    [{ ...duty, courtType: 'economic', plaintiffType: 'organization' }, 1125],
    [{ ...duty, courtType: 'economic', plaintiffType: 'organization', caseType: 'non_property_org', amount: undefined }, 900],
    [{ ...duty, courtType: 'supreme_economic', plaintiffType: 'organization', caseType: 'appeal',
      amount: undefined, originalCaseType: 'non_property_org', originalCourtLevel: 'economic' }, 720],
  ];
  for (const [request, previous] of scenarios) {
    for (const [date, expected] of [['2026-11-13', previous], ['2026-11-14', 1.01]]) {
      const dated = { ...request, date };
      const result = api.calculateDutyRequest(dated);
      assert.equal(result.amount, expected);
      assert.deepEqual(result.rules, api.getDutyEdition(date, history).rules);
      assert.equal(result.rulesVersion, result.rules.version);
      assert.deepEqual(JSON.parse(JSON.stringify(result)).rules, result.rules);
      const { courtType, amount, date: filingDate, ...config } = dated;
      const calculated = courtType === 'common' ? api.calculateCommonCourtDuty(config, amount, filingDate)
        : api.calculateEconomicCourtDuty({ ...config, courtLevel: courtType }, amount, filingDate);
      assert.equal(calculated, expected);
    }
  }
  // Undated compatibility functions remain pinned to the original tariff edition.
  assert.equal(api.calculateCommonCourtDutyWithBaseValue({ caseType: 'property', plaintiffType: 'individual' }, 45, 1000), 135);
});

test('reference history preserves effective intervals and stops at its published coverage limit', () => {
  assert.equal(api.getBaseValueInfo('2025-12-31').dateTo, '2025-12-31');
  assert.equal(api.getRefinancingRateInfo('2026-05-31').dateTo, '2026-05-31');
  assert.throws(() => api.getBaseValueInfo('2027-01-01'), api.CalculationError);
  assert.throws(() => api.getRefinancingRateInfo('2026-11-14'), api.CalculationError);
});

test('NBRB cache separates dates across the actual rate change and protects cached data', async () => {
  const requests = [];
  const service = new NbrbService({ fetch: async url => {
    const date = new URL(url).searchParams.get('ondate'); requests.push(date);
    return json(date === '2026-05-31' ? [row('2025-06-25T00:00:00', 9.75)] : [row('2026-06-01T00:00:00', 9.25)]);
  } });
  assert.equal((await service.fetchRefinancingRate('2026-05-31')).rate, 9.75);
  const latest = await service.fetchRefinancingRate('2026-06-01');
  assert.equal(latest.rate, 9.25);
  latest.rate = 100;
  latest.warnings.push('caller change');
  const cached = await service.fetchRefinancingRate('2026-06-01');
  assert.equal(cached.rate, 9.25);
  assert.deepEqual(cached.warnings, []);
  assert.equal(cached.requestedOn, '2026-06-01');
  assert.equal(cached.date, '2026-06-01');
  assert.equal(cached.fallback, false);
  assert.deepEqual(requests, ['2026-05-31', '2026-06-01']);
});

test('NBRB default date and explicit current Minsk date share one cache entry', async () => {
  let calls = 0;
  const service = new NbrbService({ fetch: async () => { calls++; return json([row('2026-06-01', 9.25)]); } });
  await service.fetchRefinancingRate();
  const explicit = await service.fetchRefinancingRate(api.today());
  assert.equal(explicit.requestedOn, api.today());
  assert.equal(calls, 1);
});

test('NBRB refreshes the cached response after its one-hour TTL', async () => {
  let time = Date.UTC(2026, 5, 1), calls = 0;
  const service = new NbrbService({ now: () => time, fetch: async () => {
    calls++; return json([row('2026-06-01', 9.25)]);
  } });
  await service.fetchRefinancingRate('2026-06-01');
  time += 60 * 60 * 1000 - 1;
  await service.fetchRefinancingRate('2026-06-01');
  assert.equal(calls, 1);
  time++;
  await service.fetchRefinancingRate('2026-06-01');
  assert.equal(calls, 2);
});

test('NBRB selects the historical rate independently of response order', async () => {
  const service = new NbrbService({ fetch: async () => json([
    row('2026-06-01', 9.25), row('2023-06-28', 9.5), row('2025-06-25', 9.75),
  ]) });
  const result = await service.fetchRefinancingRate('2026-05-31');
  assert.equal(result.rate, 9.75);
  assert.equal(result.date, '2025-06-25');
  assert.equal(result.dateTo, '2026-05-31');
});

test('invalid NBRB data is not cached as live data and produces a marked dated fallback', async () => {
  // Invalid shapes, missing fields, wrong types, negative rates, bad dates, no applicable record and duplicates.
  const invalid = [null, [], [{ Value: 9.25 }], [row('2026-06-01', '9.25')], [row('2026-06-01', -1)],
    [row('2026-02-30', 9.25)], [row('2026-06-02', 9.25)], [row('2026-06-01', 9.25), row('2026-06-01', 9.25)]];
  for (const data of invalid) {
    let calls = 0;
    const service = new NbrbService({ fetch: async () => { calls++; return json(data); } });
    const fallback = await service.getRefinancingRateForDate('2026-06-01');
    assert.equal(fallback.fallback, true);
    assert.equal(fallback.rate, 9.25);
    assert.equal(fallback.date, '2026-06-01');
    assert.equal(fallback.requestedOn, '2026-06-01');
    assert.equal(fallback.source, 'https://nalog.gov.by/reference/penalty_rate/');
    assert.ok(fallback.warnings.length > 0);
    await service.getRefinancingRateForDate('2026-06-01');
    assert.equal(calls, 2);
  }
});

test('network, HTTP and JSON errors fall back to the requested historical rate', async () => {
  for (const request of [async () => { throw new Error('offline'); }, async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } })]) {
    const result = await new NbrbService({ fetch: request }).getRefinancingRateForDate('2026-05-31');
    assert.equal(result.rate, 9.75);
    assert.equal(result.date, '2025-06-25');
    assert.equal(result.dateTo, '2026-05-31');
    assert.equal(result.fallback, true);
  }
});

test('timeout aborts both a stalled request and stalled body reading, then uses fallback', async () => {
  for (const hangInBody of [false, true]) {
    let signal;
    const service = new NbrbService({ timeoutMs: 20, fetch: async (_url, options) => {
      signal = options.signal;
      const pending = new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
      return hangInBody ? { ok: true, json: () => pending } : pending;
    } });
    assert.equal((await service.getRefinancingRateForDate('2026-06-01')).fallback, true);
    assert.equal(signal.aborted, true);
  }
});

test('NBRB rejects invalid or future dates and cannot invent fallback before history coverage', async () => {
  let calls = 0;
  const service = new NbrbService({ fetch: async () => { calls++; throw new Error('offline'); } });
  const tomorrow = api.parseDate(api.today()).add({ days: 1 }).toString();
  for (const date of ['2026-02-30', '2026-06-01T00:00:00Z', tomorrow]) await assert.rejects(service.getRefinancingRateForDate(date));
  assert.equal(calls, 0);
  await assert.rejects(service.getRefinancingRateForDate('1999-12-20'), api.CalculationError);
});
