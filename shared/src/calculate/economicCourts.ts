import { getBaseValue } from '../api/baseValue';

function calcPropertyDutyEconomics(amount: number, date: Date | string): number {
  const baseValue = getBaseValue(date);
  const BV = baseValue;
  
  if (amount <= 100 * BV) {
    return 25 * BV;
  }
  
  if (amount <= 1000 * BV) {
    return amount * 0.05;
  }
  
  if (amount <= 10000 * BV) {
    const base = 5 * 1000 * BV / 100;
    const over = amount - 1000 * BV;
    return base + over * 0.03;
  }
  
  const base = 5 * 1000 * BV / 100 + (10000 * BV - 1000 * BV) * 0.03;
  const over = amount - 10000 * BV;
  const result = base + over * 0.01;
  
  const minAt10000 = 5 * 1000 * BV / 100 + (10000 * BV - 1000 * BV) * 0.03;
  return Math.max(result, minAt10000);
}

export type EconomicCaseType = 
  | 'property'              // имущественный иск в ЭС
  | 'property_quality'      // спор о качестве поставленного товара
  | 'non_property_org'     // неимущественный иск (юрлицо)
  | 'non_property_ip'      // неимущественный иск (ИП)
  | 'non_property_person'  // неимущественный иск (гражданин)
  | 'subsidiary'           // привлечение к субсидиарной ответственности
  | 'appeal'              // апелляционная жалоба
  | 'cassation'           // кассационная жалоба
  | 'supervision'         // надзорная жалоба
  | 'court_order'        // приказное производство
  | 'bankruptcy'         // банкротство
  | 'fact_establishment' // установление факта
  | 'challenge_act'     // оспаривание акта
  | 'other_complaint';  // иная жалоба

export interface EconomicRatesConfig {
  caseType: EconomicCaseType;
  plaintiffType: 'individual' | 'organization' | 'ip';
  courtLevel: 'economic' | 'supreme_economic';
}

export function calculateEconomicCourtDuty(
  config: EconomicRatesConfig, 
  amount?: number, 
  date: Date | string = new Date()
): number {
  const baseValue = getBaseValue(date);
  const { caseType, plaintiffType, courtLevel } = config;
  
  const supremeMultiplier = courtLevel === 'supreme_economic' ? 2.5 : 1;

  switch (caseType) {
    case 'property':
      if (!amount || amount <= 0) {
        throw new Error('Для имущественного иска необходимо указать сумму');
      }
      return calcPropertyDutyEconomics(amount, date);

    case 'property_quality':
      if (!amount || amount <= 0) {
        throw new Error('Необходимо указать сумму для расчета по качеству товара');
      }
      const baseForQuality = calcPropertyDutyEconomics(amount, date);
      return baseForQuality * 0.8;

    case 'non_property_org':
      return courtLevel === 'supreme_economic' ? 50 * baseValue : 20 * baseValue;

    case 'non_property_ip':
      return 10 * baseValue;

    case 'non_property_person':
      return 5 * baseValue;

    case 'subsidiary':
      return 25 * baseValue * supremeMultiplier;

    case 'appeal':
    case 'cassation':
    case 'supervision':
      if (amount && amount > 0) {
        const baseDuty = calcPropertyDutyEconomics(amount, date);
        return baseDuty * 0.8;
      }
      return 0.8 * (25 * baseValue);

    case 'court_order':
      if (!amount || amount <= 0) {
        throw new Error('Для приказного производства необходимо указать сумму');
      }
      const orderBase = getBaseValue(date);
      if (amount <= 100 * orderBase) {
        return 2 * orderBase;
      } else if (amount <= 300 * orderBase) {
        return 5 * orderBase;
      }
      return 7 * orderBase;

    case 'bankruptcy':
      return 10 * baseValue;

    case 'fact_establishment':
      return courtLevel === 'supreme_economic' ? 15 * baseValue : 10 * baseValue;

    case 'challenge_act':
      return courtLevel === 'supreme_economic' ? 50 * baseValue : 20 * baseValue;

    case 'other_complaint':
      return 0.5 * baseValue;

    default:
      throw new Error('Неизвестный тип дела');
  }
}

export function getEconomicCaseTypesList(): { id: EconomicCaseType; name: string }[] {
  return [
    { id: 'property', name: 'Исковое заявление имущественного характера' },
    { id: 'property_quality', name: 'Исковое заявление по спору о качестве поставленного товара' },
    { id: 'non_property_org', name: 'Исковое заявление неимущественного характера (юрлицо)' },
    { id: 'non_property_ip', name: 'Исковое заявление неимущественного характера (ИП)' },
    { id: 'non_property_person', name: 'Исковое заявление неимущественного характера (гражданин)' },
    { id: 'subsidiary', name: 'Исковое заявление о привлечении к субсидиарной ответственности' },
    { id: 'appeal', name: 'Апелляционная жалоба' },
    { id: 'cassation', name: 'Кассационная жалоба' },
    { id: 'supervision', name: 'Надзорная жалоба' },
    { id: 'court_order', name: 'Заявление о возбуждении приказного производства' },
    { id: 'bankruptcy', name: 'Заявление о признании банкротом' },
    { id: 'fact_establishment', name: 'Заявление об установлении фактов' },
    { id: 'challenge_act', name: 'Заявление об оспаривании решений' },
    { id: 'other_complaint', name: 'Иная жалоба' },
  ];
}