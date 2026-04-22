export interface Discount {
  id: string;
  name: string;
  description: string;
  articleRef: string;
  appliesTo: 'individual' | 'organization' | 'both';
  courtTypes: string[];
  caseTypes: string[];
}

export const discounts: Discount[] = [
  {
    id: '1.1',
    name: 'Истцы по алиментам',
    description: 'Истцы (взыскатели, заявители) за рассмотрение исковых заявлений о взыскании алиментов или расходов, затраченных государством на содержание детей',
    articleRef: 'п.1.1 ст.285 НК',
    appliesTo: 'both',
    courtTypes: ['common', 'economic', 'supreme'],
    caseTypes: ['alimony', 'child_expenses']
  },
  {
    id: '1.2',
    name: 'Истцы по возмещению вреда',
    description: 'Истцы за рассмотрение исковых заявлений о возмещении вреда, причиненного увечьем или иным повреждением здоровья, а также смертью кормильца',
    articleRef: 'п.1.2 ст.285 НК',
    appliesTo: 'both',
    courtTypes: ['common', 'economic', 'supreme'],
    caseTypes: ['damage', 'compensation']
  },
  {
    id: '1.3',
    name: 'Инвалиды I и II группы',
    description: 'Инвалиды I и II группы',
    articleRef: 'п.1.3 ст.285 НК',
    appliesTo: 'individual',
    courtTypes: ['common', 'economic', 'supreme'],
    caseTypes: ['all']
  },
  {
    id: '1.4',
    name: 'Ветераны ВОВ',
    description: 'Участники Великой Отечественной войны, инвалиды боевых действий на территории других государств',
    articleRef: 'п.1.4 ст.285 НК',
    appliesTo: 'individual',
    courtTypes: ['common', 'economic', 'supreme'],
    caseTypes: ['all']
  },
  {
    id: '1.5',
    name: 'Многодетные семьи',
    description: 'Многодетные семьи (имеющие троих и более детей)',
    articleRef: 'п.1.5 ст.285 НК',
    appliesTo: 'individual',
    courtTypes: ['common', 'economic', 'supreme'],
    caseTypes: ['all']
  },
  {
    id: '1.7',
    name: 'Защита прав потребителей',
    description: 'Истцы за рассмотрение исковых заявлений по спорам, связанным с нарушением прав потребителей',
    articleRef: 'п.1.7 ст.285 НК',
    appliesTo: 'individual',
    courtTypes: ['common', 'economic', 'supreme'],
    caseTypes: ['consumer_rights']
  },
  {
    id: '1.8',
    name: 'Дела о банкротстве',
    description: 'Управляющий (антикризисный управляющий) за рассмотрение заявления о банкротстве',
    articleRef: 'п.1.8 ст.285 НК',
    appliesTo: 'organization',
    courtTypes: ['economic', 'supreme'],
    caseTypes: ['bankruptcy']
  },
  {
    id: '2.1',
    name: 'Физические лица (судебные дела)',
    description: 'Физические лица по судебным делам, связанным с социальными выплатами, пенсиями, возмещением вреда',
    articleRef: 'п.2.1 ст.285 НК',
    appliesTo: 'individual',
    courtTypes: ['common', 'economic', 'supreme'],
    caseTypes: ['social', 'pension', 'damage']
  },
  {
    id: '2.1-1',
    name: 'Страхователи по спорам о качестве',
    description: 'Страхователи (физические лица) по спорам о качестве поставленного товара',
    articleRef: 'п.2.1-1 ст.285 НК',
    appliesTo: 'individual',
    courtTypes: ['economic', 'supreme'],
    caseTypes: ['quality_dispute']
  },
  {
    id: '2.13',
    name: 'Объекты жилищных отношений',
    description: 'Споры, связанные с заключением, изменением, исполнением, прекращением договоров создания объектов долевого строительства',
    articleRef: 'п.2.13 ст.285 НК',
    appliesTo: 'both',
    courtTypes: ['common', 'economic', 'supreme'],
    caseTypes: ['housing']
  }
];

export function getDiscountById(id: string): Discount | undefined {
  return discounts.find(d => d.id === id);
}

export function getDiscountsForCourt(courtType: string, caseType: string): Discount[] {
  return discounts.filter(d => 
    d.courtTypes.includes(courtType) || d.courtTypes.includes('all')
  );
}