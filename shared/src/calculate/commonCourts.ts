import { getBaseValue } from '../api/baseValue';

function calcPropertyDuty(amount: number, date: Date | string): number {
  const baseValue = getBaseValue(date);
  const minDuty = 2 * baseValue;
  const calculated = amount * 0.05;
  return Math.max(calculated, minDuty);
}

export type CaseType = 
  | 'property'           // имущественный иск
  | 'non_property'       // неимущественный иск
  | 'divorce'            // расторжение брака
  | 'divorce_repeat'     // повторный брак
  | 'paternity'         // установление отцовства
  | 'alimony'            // алименты
  | 'appeal'            // апелляционная жалоба
  | 'cassation'          // кассационная жалоба
  | 'supervision'        // надзорная жалоба
  | 'court_order'        // судебный приказ
  | 'administrative'    // административное дело
  | 'challenge_act'     // оспаривание акта
  | 'fact_establishment'; // установление факта

export interface CourtRatesConfig {
  caseType: CaseType;
  isRepeated?: boolean;
  plaintiffType: 'individual' | 'organization';
}

export function calculateCommonCourtDuty(config: CourtRatesConfig, amount?: number, date: Date | string = new Date()): number {
  const baseValue = getBaseValue(date);
  const { caseType, isRepeated, plaintiffType } = config;

  switch (caseType) {
    case 'property':
      if (!amount || amount <= 0) {
        throw new Error('Для имущественного иска необходимо указать сумму');
      }
      return calcPropertyDuty(amount, date);

    case 'non_property':
      return plaintiffType === 'organization' ? 20 * baseValue : 6 * baseValue;

    case 'divorce':
      return isRepeated ? 8 * baseValue : 4 * baseValue;

    case 'paternity':
    case 'fact_establishment':
      return plaintiffType === 'organization' ? 10 * baseValue : 3 * baseValue;

    case 'alimony':
      return baseValue;

    case 'appeal':
    case 'cassation':
    case 'supervision':
      if (amount && amount > 0) {
        const baseDuty = calcPropertyDuty(amount, date);
        return baseDuty * 0.8;
      }
      return 0.8 * (plaintiffType === 'organization' ? 20 * baseValue : 6 * baseValue);

    case 'court_order':
      if (!amount || amount <= 0) {
        throw new Error('Для судебного приказа необходимо указать сумму взыскания');
      }
      return calcPropertyDuty(amount, date) * 0.5;

    case 'administrative':
      return 0.5 * baseValue;

    case 'challenge_act':
      return plaintiffType === 'organization' ? 20 * baseValue : 6 * baseValue;

    default:
      throw new Error('Неизвестный тип дела');
  }
}

export function getCaseTypesList(): { id: CaseType; name: string }[] {
  return [
    { id: 'property', name: 'Исковое заявление имущественного характера' },
    { id: 'non_property', name: 'Исковое заявление неимущественного характера' },
    { id: 'divorce', name: 'Расторжение брака' },
    { id: 'paternity', name: 'Установление отцовства' },
    { id: 'alimony', name: 'Взыскание алиментов' },
    { id: 'appeal', name: 'Апелляционная жалоба' },
    { id: 'cassation', name: 'Кассационная жалоба' },
    { id: 'supervision', name: 'Надзорная жалоба' },
    { id: 'court_order', name: 'Заявление о вынесении судебного приказа' },
    { id: 'administrative', name: 'Дело об административном правонарушении' },
    { id: 'challenge_act', name: 'Заявление об оспаривании решения' },
    { id: 'fact_establishment', name: 'Заявление об установлении факта' },
  ];
}