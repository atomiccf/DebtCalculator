import { calculateDuty, getBaseValue, getCaseTypesList, getEconomicCaseTypesList } from './calculate';
import { calculateCommonCourtDuty } from './calculate/rates/commonCourts';
import { calculateEconomicCourtDuty } from './calculate/rates/economicCourts';

console.log('=== Тест калькулятора госпошлины ===\n');

console.log('Базовая величина:', getBaseValue(), 'BYN');

console.log('\n--- Суды общей юрисдикции ---');

const commonCases = getCaseTypesList();
commonCases.slice(0, 3).forEach(c => {
  console.log(`- ${c.name}`);
});

console.log('\nТест: Иск имущественный 5000 BYN');
const duty1 = calculateCommonCourtDuty(
  { caseType: 'property', plaintiffType: 'individual' },
  5000,
  '2026-01-01'
);
console.log(`  Результат: ${duty1} BYN (ожидается ~250, т.к. 5% от 5000 = 250, но мин. 90)`);

console.log('\nТест: Иск имущественный 200 BYN');
const duty2 = calculateCommonCourtDuty(
  { caseType: 'property', plaintiffType: 'individual' },
  200,
  '2026-01-01'
);
console.log(`  Результат: ${duty2} BYN (ожидается 90 = 2*45, мин. 2 БВ)`);

console.log('\nТест: Расторжение брака');
const duty3 = calculateCommonCourtDuty(
  { caseType: 'divorce', plaintiffType: 'individual' },
  undefined,
  '2026-01-01'
);
console.log(`  Результат: ${duty3} BYN (ожидается 180 = 4*45)`);

console.log('\n--- Экономические суды ---');

const econCases = getEconomicCaseTypesList();
econCases.slice(0, 3).forEach(c => {
  console.log(`- ${c.name}`);
});

console.log('\nТест: Иск имущественный 10000 BYN в экономическом суде');
const dutyEcon1 = calculateEconomicCourtDuty(
  { caseType: 'property', plaintiffType: 'organization', courtLevel: 'economic' },
  10000,
  '2026-01-01'
);
console.log(`  Результат: ${dutyEcon1} BYN`);

console.log('\n=== Тест завершён ===');