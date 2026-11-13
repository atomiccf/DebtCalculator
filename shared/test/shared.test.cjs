'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/register.cjs');

const api = require('../src/index.ts');
const { Temporal } = require('@js-temporal/polyfill');
const period = { debt: 1000, rate: 0.1, startDate: '2026-10-01', endDate: '2026-10-20' };
const common = { caseType: 'property', plaintiffType: 'individual' };
const economic = { caseType: 'property', plaintiffType: 'organization', courtLevel: 'economic' };

test('daily penalty preserves inclusive days and the legacy response shape', () => {
  assert.deepEqual(api.calculatePenalty(period), {
    days: 20, penalty: 20, rate: 0.1, yearDivisor: 365,
    breakdown: [{ startDate: period.startDate, endDate: period.endDate, days: 20, rate: 0.1, amount: 20 }],
  });
  assert.equal(api.calculatePenalty({ ...period, endDate: period.startDate }).days, 1);
  assert.throws(() => api.calculatePenalty({ ...period, rate: 0 }));
});

test('money uses decimal half-up rounding and exact aggregation', () => {
  assert.equal(api.roundMoney(1.005), 1.01);
  assert.equal(api.roundMoney(2.675), 2.68);
  assert.equal(api.sumMoney([0.1, 0.2]), 0.3);
  assert.equal(api.calculatePenalty({ debt: 1, startDate: '2026-01-01', endDate: '2026-01-01', rate: 0.5 }).penalty, 0.01);
});

test('accrual rejects invalid money, rates and periods at the core boundary', () => {
  // Distinct failure classes, checked once rather than through every wrapper.
  for (const debt of [undefined, '100', 0, -1, 1.001, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => api.calculateDailyAccrual({ ...period, debt }), `debt: ${debt}`);
  }
  for (const rate of [null, '0.1', NaN, Infinity, 0, -0.1]) {
    assert.throws(() => api.calculateDailyAccrual({ ...period, rate }), `rate: ${rate}`);
  }
  for (const startDate of ['2026-02-30', '2026-10-21']) {
    assert.throws(() => api.calculateDailyAccrual({ ...period, startDate }), startDate);
  }
});

test('dates use UTC for Date inputs and count leap days', () => {
  assert.equal(api.parseDate(new Date('2026-01-01T00:30:00Z')).toString(), '2026-01-01');
  assert.equal(api.parseDate(Temporal.PlainDate.from('2026-01-01')).toString(), '2026-01-01');
  assert.equal(api.calculateDaysInPeriod('2024-02-28', '2024-03-01'), 3);
  assert.equal(api.calculateDaysInPeriod('2023-02-28', '2023-03-01'), 2);
  assert.equal(api.getDaysInYear(2000), 366);
});

test('annual conventions are explicit; the existing wrapper keeps its default', () => {
  const input = { debt: 100000, rate: 10, startDate: '2023-12-31', endDate: '2024-01-02' };
  assert.equal(api.calculateAnnualAccrual({ ...input, dayCount: 'actual/actual' }).amount, 82.04);
  assert.equal(api.calculateAnnualAccrual({ ...input, dayCount: 'start-year' }).amount, 82.19);
  assert.equal(api.calculateAnnualAccrual({ ...input, dayCount: 'end-year' }).amount, 81.97);
  assert.equal(api.calculateInterestOnDebt(input.debt, input.startDate, input.endDate, input.rate), 82.19);
  assert.equal(api.calculateInterestOnDebt(input.debt, input.startDate, input.endDate, input.rate, 'actual/actual'), 82.04);
  assert.equal(api.calculateAnnualAccrual({ ...input, dayCount: 365 }).amount, 82.19);
  assert.equal(api.calculateAnnualAccrual({ ...input, dayCount: 366 }).amount, 81.97);
  assert.equal(api.calculateAnnualAccrual({ ...input, dayCount: 360 }).amount, 83.33);
  assert.throws(() => api.calculateAnnualAccrual({ ...input, dayCount: 'unknown' }));
  assert.throws(() => api.calculateAnnualAccrual(input));
  const divisor = api.calculateExactYearDivisor(input.startDate, input.endDate);
  assert.ok(divisor > 365 && divisor < 366);
  assert.ok(Math.abs(divisor - 3 / (1 / 365 + 2 / 366)) < 1e-10);
});

test('actual/actual covers full calendar years and rounds only the complete period', () => {
  const period = { startDate: '2023-01-01', endDate: '2024-12-31', dayCount: 'actual/actual' };
  assert.equal(api.calculateAnnualAccrual({ ...period, debt: 1000, rate: 10 }).amount, 200);
  // Each year accrues 0.005 BYN: rounding each year would incorrectly produce 0.02.
  assert.equal(api.calculateAnnualAccrual({ ...period, debt: 1, rate: 0.5 }).amount, 0.01);
});

test('rate changes use the rate effective in each interval, in any input order', () => {
  const rates = [{ rate: 0.2, dateFrom: '2026-01-06' }, { rate: 0.1, dateFrom: '2025-01-01' }, { rate: 0.3, dateFrom: '2027-01-01' }];
  const original = JSON.stringify(rates);
  const result = api.calculatePenaltyWithRateChange(1000, '2026-01-01', '2026-01-10', rates);
  assert.equal(result.penalty, 15);
  assert.equal(result.rate, 0.1);
  assert.deepEqual(result.breakdown.map(row => [row.days, row.rate, row.amount]), [[5, 0.1, 5], [5, 0.2, 10]]);
  assert.equal(result.days, result.breakdown.reduce((sum, row) => sum + row.days, 0));
  assert.equal(JSON.stringify(rates), original);
});

test('rate changes at the first and final day are included correctly', () => {
  const result = api.calculatePenaltyWithRateChange(1000, '2026-01-01', '2026-01-10', [
    { rate: 0.1, dateFrom: '2026-01-01' }, { rate: 0.2, dateFrom: '2026-01-10' },
  ]);
  assert.equal(result.penalty, 11);
  assert.deepEqual(result.breakdown.map(row => row.days), [9, 1]);
});

test('rate history requires coverage and unambiguous dates', () => {
  for (const rates of [[], null, [{ rate: 1, dateFrom: '2027-01-01' }],
    [{ rate: 1, dateFrom: '2026-01-01' }, { rate: 2, dateFrom: '2026-01-01' }],
    [{ rate: NaN, dateFrom: '2025-01-01' }], [{ rate: 0, dateFrom: '2025-01-01' }]]) {
    assert.throws(() => api.calculatePenaltyWithRateChange(1000, '2026-01-01', '2026-01-10', rates));
  }
});

test('rate-change totals equal the rounded breakdown amounts', () => {
  const result = api.calculatePenaltyWithRateChange(1, '2026-01-01', '2026-01-02', [
    { rate: 0.5, dateFrom: '2026-01-01' }, { rate: 0.6, dateFrom: '2026-01-02' },
  ]);
  assert.equal(result.penalty, 0.02);
});

test('reference rates follow verified changes, including historical boundaries', () => {
  for (const [date, value] of [
    ['2023-01-22', 12], ['2023-01-23', 11.5], ['2023-03-01', 11], ['2023-04-03', 10.5],
    ['2023-05-02', 10], ['2023-05-31', 9.75], ['2023-06-28', 9.5], ['2024-02-01', 9.5],
    ['2025-06-24', 9.5], ['2025-06-25', 9.75], ['2026-05-31', 9.75], ['2026-06-01', 9.25],
  ]) assert.equal(api.getRefinancingRate(date), value, date);
});

test('reference lookup never substitutes data before coverage or inside a gap', () => {
  assert.throws(() => api.getBaseValue('2018-12-31'));
  assert.throws(() => api.getRefinancingRate('1999-01-01'));
  const records = [{ dateFrom: '2025-01-01', dateTo: '2025-12-31', value: 1 }, { dateFrom: '2027-01-01', value: 2 }];
  assert.equal(api.getEffectiveRecord(records, '2025-12-31').value, 1);
  assert.throws(() => api.getEffectiveRecord(records, '2026-01-01'));
  assert.equal(api.getEffectiveRecord([...records].reverse(), '2027-01-01').value, 2);
  assert.throws(() => api.getEffectiveRecord([{ dateFrom: '2026-01-02', dateTo: '2026-01-01' }], '2026-01-01'));
  assert.throws(() => api.getEffectiveRecord([{ dateFrom: '2026-01-01' }, { dateFrom: '2026-01-01' }], '2026-01-01'));
});

test('bundled reference histories cannot be mutated', () => {
  assert.throws(() => api.refinancingRateHistory.push({}));
  assert.throws(() => { api.getRefinancingRateInfo('2026-06-01').value = 100; });
  assert.throws(() => { api.baseValueHistory[0].value = 100; });
});

test('interest adapters support explicit reference data and sum rounded rows', () => {
  const docs = [{ debt: 100, name: 'a', startDate: '2026-10-20', endDate: '2026-10-20' },
    { debt: 100, name: 'b', startDate: '2026-10-20', endDate: '2026-10-20' }];
  const result = api.calculateInterest366Multiple(docs);
  assert.deepEqual(result.results.map(row => row.interest), [0.03, 0.03]);
  assert.equal(result.total, 0.06);
  assert.equal(result.results[0].refinancingRate, 9.25);
});

test('invalid documents are rejected consistently', () => {
  for (const documents of [null, {}, [], [null], [{ ...period, name: 1 }], [{ ...period, name: '  ' }]]) {
    assert.throws(() => api.calculateInterest366Multiple(documents));
  }
});

test('dated duty wrappers use the base value applicable to the filing date', () => {
  assert.equal(api.calculateCommonCourtDuty(common, 10000, '2026-07-01'), 500);
  assert.equal(api.calculateEconomicCourtDuty(economic, 45000, '2026-07-01'), 2250);
});

test('duty calculations round only the final amount, including exact half-kopecks', () => {
  assert.equal(api.calculateCommonCourtDutyWithBaseValue(common, 45, 3000.10), 150.01);
  assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'appeal' }, 45, 4000.12), 160);
  assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'property_quality' }, 45, 25000.12), 1000);
});

test('economic tariffs follow Appendix 15 and retain the minimum across brackets', () => {
  // Minimum 25 BV, growth above 500 BV, 3% above 1000 BV, then the 320 BV floor.
  for (const [amount, expected] of [[1000, 1125], [14000, 1125], [22500, 1125],
    [22501, 1125.05], [45000, 2250], [45001, 2250.03],
    [450000, 14400], [450001, 14400], [1440001, 14400.01]]) {
    assert.equal(api.calculateEconomicCourtDutyWithBaseValue(economic, 45, amount), expected);
  }
});

test('duty functions reject invalid money, enums, and incompatible plaintiffs', () => {
  for (const amount of [NaN, Infinity, -1, 0, '100', null, 1.001]) {
    assert.throws(() => api.calculateCommonCourtDutyWithBaseValue(common, 45, amount));
  }
  assert.throws(() => api.calculateCommonCourtDutyWithBaseValue({ ...common, plaintiffType: 'unknown' }, 45, 100));
  assert.throws(() => api.calculateEconomicCourtDutyWithBaseValue({ ...economic, courtLevel: 'unknown' }, 45, 100));
  assert.throws(() => api.calculateEconomicCourtDutyWithBaseValue({ ...economic, courtLevel: 'common' }, 45, 100));
  assert.throws(() => api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'non_property_ip' }, 45));
  assert.throws(() => api.calculateCommonCourtDutyWithBaseValue(common, NaN, 100));
  assert.throws(() => api.calculateCommonCourtDutyWithBaseValue(common, 45));
  assert.throws(() => api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'unknown' }, 45, 100));
});

test('fixed common-court tariffs cover the supported kinds of claim', () => {
  const fixtures = { non_property: 135, divorce: 180, divorce_repeat: 360,
    divorce_missing: 45, paternity: 135, challenge_act: 45, fact_establishment: 90,
    contract_dispute: 225 };
  for (const [caseType, expected] of Object.entries(fixtures)) {
    assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType }, 45), expected, caseType);
  }
  assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'divorce', isRepeated: true }, 45), 360);
});

test('fixed economic-court tariffs cover applicant types and claims', () => {
  const fixtures = { non_property_org: 900, non_property_ip: 900, non_property_person: 900,
    subsidiary: 1125, bankruptcy: 450, fact_establishment: 450, challenge_act: 900,
    other_complaint: 22.5, contract_dispute: 900 };
  for (const [caseType, expected] of Object.entries(fixtures)) {
    const plaintiffType = caseType === 'non_property_ip' ? 'ip'
      : caseType === 'non_property_person' ? 'individual' : 'organization';
    assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType, plaintiffType }, 45), expected, caseType);
  }
  assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'subsidiary', courtLevel: 'supreme_economic' }, 45), 1125);
});

test('Appendix 13: progressive tariff and the upper-bracket floor', () => {
  for (const [amount, expected] of [[100, 135], [45000, 2250], [50000, 2400],
    [450000, 14400], [1000000, 14400], [1440001, 14400.01]]) {
    assert.equal(api.calculateCommonCourtDutyWithBaseValue(common, 45, amount), expected);
  }
});

test('Appendices 13 and 15: court orders use 2, 5 and 7 base values', () => {
  for (const [amount, expected] of [[1000, 90], [10000, 225], [20000, 315]]) {
    assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'court_order' }, 45, amount), expected);
    assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'court_order' }, 45, amount), expected);
  }
  for (const [amount, expected] of [[4499.99, 90], [4500, 225], [4500.01, 225], [13499.99, 225], [13500, 315], [13500.01, 315]]) {
    assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'court_order' }, 45, amount), expected);
    assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'court_order' }, 45, amount), expected);
  }
});

test('Appendix 15 separates contract disputes from generic non-property claims', () => {
  for (const [plaintiffType, alias, contract] of [['ip', 'non_property_ip', 450], ['individual', 'non_property_person', 225]]) {
    assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, plaintiffType, caseType: alias }, 45), 900);
    assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, plaintiffType, caseType: 'contract_dispute' }, 45), contract);
  }
  assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'non_property_org', courtLevel: 'appellate_economic' }, 45), 1800);
  assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'fact_establishment', courtLevel: 'appellate_economic' }, 45), 675);
  assert.throws(() => api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'fact_establishment', courtLevel: 'supreme_economic' }, 45));
});

test('appeals require the original claim and, where relevant, its court', () => {
  assert.throws(() => api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'appeal' }, 45));
  assert.throws(() => api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'appeal' }, 45));
  assert.throws(() => api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'appeal', originalCaseType: 'non_property_org' }, 45));
  for (const caseType of ['appeal', 'cassation', 'supervision']) {
    assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType, originalCaseType: 'non_property' }, 45), 108);
  }
  assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'appeal', courtLevel: 'appellate_economic',
    originalCaseType: 'non_property_org', originalCourtLevel: 'economic' }, 45), 720);
  assert.equal(api.calculateEconomicCourtDutyWithBaseValue({ ...economic, caseType: 'appeal',
    originalCaseType: 'subsidiary', courtLevel: 'supreme_economic' }, 45), 900);
});

test('automatic exemptions apply to alimony and the supported appeal stages', () => {
  assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'alimony' }, 45), 0);
  for (const originalCaseType of ['alimony', 'divorce', 'divorce_repeat', 'divorce_missing']) {
    assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'appeal', originalCaseType }, 45), 0);
  }
  assert.throws(() => api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'cassation', originalCaseType: 'alimony' }, 45));
});

test('alimony catalog entry agrees with the legal basis documented in LEGAL_REVIEW.md', () => {
  // Known data defect: the legal citation is still 1.1 instead of the documented 1.1.2.
  // Use the actual two-argument API; do not assume applicant/stage filtering exists.
  const entries = api.getDiscountsForCourt('common', 'alimony');
  assert.ok(entries.some(entry => /1\.1\.2\b/.test(entry.articleRef) && /285/.test(entry.articleRef)),
    'Expected the documented alimony basis: subparagraph 1.1.2, Article 285');
});

test('administrative complaint rates require the sanction facts', () => {
  assert.throws(() => api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'administrative' }, 45));
  for (const [fineAmount, expected] of [[449.99, 22.5], [450, 90], [4499.99, 90], [4500, 135]]) {
    assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'administrative', administrativePenalty: 'fine', fineAmount }, 45), expected);
  }
  assert.equal(api.calculateCommonCourtDutyWithBaseValue({ ...common, caseType: 'administrative', administrativePenalty: 'other' }, 45), 45);
});

test('Article 366 selects a rate on the legal event date, separately from the period end', () => {
  const input = { debt: 10000, startDate: '2026-05-01', endDate: '2026-05-31', hasPenalty: false, dayCount: 'actual/actual' };
  const paid = api.calculateInterest366({ ...input, calculationBasis: 'payment', rateDate: '2026-05-31' });
  const judged = api.calculateInterest366({ ...input, calculationBasis: 'judgment', rateDate: '2026-06-01' });
  assert.equal(paid.refinancingRate, 9.75);
  assert.equal(judged.refinancingRate, 9.25);
  assert.equal(judged.rateDate, '2026-06-01');
  assert.equal(judged.calculationBasis, 'judgment');
  assert.deepEqual(judged.warnings, []);
  assert.throws(() => api.calculateInterest366({ ...input, calculationBasis: 'judgment' }));
  assert.ok(api.calculateInterest366(input).warnings.length > 0);
});

test('Article 366(3-1) prevents unqualified concurrent penalty and interest', () => {
  assert.throws(() => api.calculateInterest366({ ...period, hasPenalty: true }));
  assert.doesNotThrow(() => api.calculateInterest366({ ...period, hasPenalty: true, statutoryException: true }));
  assert.throws(() => api.calculateInterest366({ ...period, hasPenalty: 'false' }));
});

test('multi-year Article 366 calculations require an explicit day-count convention', () => {
  const input = { debt: 100000, startDate: '2023-12-31', endDate: '2024-01-02', refinancingRate: 10 };
  assert.throws(() => api.calculateInterest366(input));
  assert.equal(api.calculateInterest366({ ...input, dayCount: 'actual/actual' }).interest, 82.04);
});

test('penalties have no assumed statutory daily rate', () => {
  assert.throws(() => api.calculatePenalty({ debt: 1000, startDate: period.startDate, endDate: period.endDate }));
  assert.throws(() => api.calculatePenalty({ ...period, rate: 0 }));
});
