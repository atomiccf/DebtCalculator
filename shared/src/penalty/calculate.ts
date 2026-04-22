import { getRefinancingRate } from '../api/refinancingRate';

export interface PenaltyInput {
  debt: number;
  startDate: Date | string;
  endDate: Date | string;
  rate?: number;
}

export interface PenaltyResult {
  days: number;
  penalty: number;
  rate: number;
  breakdown: PenaltyPeriod[];
}

export interface PenaltyPeriod {
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  amount: number;
}

const DEFAULT_RATE = 0.1;

export function calculatePenalty(input: PenaltyInput): PenaltyResult {
  const { debt, startDate, endDate, rate = DEFAULT_RATE } = input;
  
  if (debt <= 0) {
    throw new Error('Сумма долга должна быть больше 0');
  }
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  if (isNaN(start.getTime())) {
    throw new Error('Некорректная дата начала периода');
  }
  
  if (isNaN(end.getTime())) {
    throw new Error('Некорректная дата окончания периода');
  }
  
  if (end < start) {
    throw new Error('Дата окончания не может быть раньше даты начала');
  }
  
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const penalty = (debt * rate * totalDays) / 100;
  
  return {
    days: totalDays,
    penalty: Math.round(penalty * 100) / 100,
    rate,
    breakdown: [{
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      days: totalDays,
      rate,
      amount: Math.round(penalty * 100) / 100
    }]
  };
}

export function calculatePenaltyWithRateChange(
  debt: number,
  startDate: Date | string,
  endDate: Date | string,
  rates: { rate: number; dateFrom: string }[]
): PenaltyResult {
  if (debt <= 0) {
    throw new Error('Сумма долга должна быть больше 0');
  }
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const sortedRates = [...rates].sort((a, b) => 
    new Date(a.dateFrom).getTime() - new Date(b.dateFrom).getTime()
  );
  
  let currentDate = new Date(start);
  let totalPenalty = 0;
  const breakdown: PenaltyPeriod[] = [];
  
  for (const rateInfo of sortedRates) {
    const rateDate = new Date(rateInfo.dateFrom);
    
    if (rateDate > end) break;
    
    const periodStart = currentDate > start ? currentDate : start;
    const periodEnd = rateDate <= end ? new Date(rateDate.getTime() - 1) : end;
    
    if (periodEnd < periodStart) continue;
    
    const days = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const periodPenalty = (debt * rateInfo.rate * days) / 100;
    totalPenalty += periodPenalty;
    
    breakdown.push({
      startDate: periodStart.toISOString().split('T')[0],
      endDate: periodEnd.toISOString().split('T')[0],
      days,
      rate: rateInfo.rate,
      amount: Math.round(periodPenalty * 100) / 100
    });
    
    currentDate = new Date(rateDate);
  }
  
  if (currentDate <= end) {
    const lastRate = sortedRates[sortedRates.length - 1].rate;
    const days = Math.ceil((end.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const periodPenalty = (debt * lastRate * days) / 100;
    totalPenalty += periodPenalty;
    
    breakdown.push({
      startDate: currentDate.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      days,
      rate: lastRate,
      amount: Math.round(periodPenalty * 100) / 100
    });
  }
  
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  return {
    days: totalDays,
    penalty: Math.round(totalPenalty * 100) / 100,
    rate: sortedRates[0].rate,
    breakdown
  };
}

export function calculateInterestOnDebt(
  debt: number,
  startDate: Date | string,
  endDate: Date | string,
  annualRate: number
): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const interest = (debt * annualRate * days) / (100 * 365);
  
  return Math.round(interest * 100) / 100;
}

export interface Interest366Input {
  debt: number;
  startDate: Date | string;
  endDate: Date | string;
}

export interface Interest366Result {
  debt: number;
  startDate: string;
  endDate: string;
  days: number;
  refinancingRate: number;
  interest: number;
}

export function calculateInterest366(input: Interest366Input): Interest366Result {
  const { debt, startDate, endDate } = input;
  
  if (debt <= 0) {
    throw new Error('Сумма долга должна быть больше 0');
  }
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  if (isNaN(start.getTime())) {
    throw new Error('Некорректная дата начала периода');
  }
  
  if (isNaN(end.getTime())) {
    throw new Error('Некорректная дата окончания периода');
  }
  
  if (end < start) {
    throw new Error('Дата окончания не может быть раньше даты начала');
  }
  
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const refinancingRate = getRefinancingRate(end);
  const interest = (debt * refinancingRate * days) / (100 * 365);
  
  return {
    debt,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    days,
    refinancingRate,
    interest: Math.round(interest * 100) / 100
  };
}

export interface Interest366Document {
  name: string;
  debt: number;
  startDate: Date | string;
  endDate: Date | string;
}

export interface Interest366DocumentResult {
  name: string;
  debt: number;
  startDate: string;
  endDate: string;
  days: number;
  refinancingRate: number;
  interest: number;
}

export interface Interest366MultipleResult {
  results: Interest366DocumentResult[];
  total: number;
}

export function calculateInterest366Multiple(documents: Interest366Document[]): Interest366MultipleResult {
  if (!documents || documents.length === 0) {
    throw new Error('Список документов пуст');
  }

  const results: Interest366DocumentResult[] = [];
  let total = 0;

  for (const doc of documents) {
    if (!doc.name || !doc.name.trim()) {
      throw new Error('Укажите название для каждого документа');
    }
    if (doc.debt <= 0) {
      throw new Error('Сумма долга должна быть больше 0');
    }

    const start = typeof doc.startDate === 'string' ? new Date(doc.startDate) : doc.startDate;
    const end = typeof doc.endDate === 'string' ? new Date(doc.endDate) : doc.endDate;

    if (isNaN(start.getTime())) {
      throw new Error('Некорректная дата начала для документа: ' + doc.name);
    }
    if (isNaN(end.getTime())) {
      throw new Error('Некорректная дата окончания для документа: ' + doc.name);
    }
    if (end < start) {
      throw new Error('Дата окончания не может быть раньше даты начала для документа: ' + doc.name);
    }

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const refinancingRate = getRefinancingRate(end);
    const interest = (doc.debt * refinancingRate * days) / (100 * 365);

    results.push({
      name: doc.name,
      debt: doc.debt,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      days,
      refinancingRate,
      interest: Math.round(interest * 100) / 100
    });

    total += interest;
  }

  return {
    results,
    total: Math.round(total * 100) / 100
  };
}