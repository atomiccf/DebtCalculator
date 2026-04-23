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
  yearDivisor: number;
}

export interface PenaltyPeriod {
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  amount: number;
}

const DEFAULT_RATE = 0.1;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function isLeapYearInPeriod(startDate: Date, endDate: Date): boolean {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  if (startYear === endYear) {
    return isLeapYear(startYear);
  }
  
  for (let year = startYear; year <= endYear; year++) {
    if (isLeapYear(year)) {
      const leapYearStart = new Date(year, 1, 29);
      if (leapYearStart >= startDate && leapYearStart <= endDate) {
        return true;
      }
    }
  }
  
  return false;
}

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
  const yearDivisor = isLeapYearInPeriod(start, end) ? 366 : 365;
  const penalty = (debt * rate * totalDays) / (100 * yearDivisor);
  
  return {
    days: totalDays,
    penalty: Math.round(penalty * 100) / 100,
    rate,
    yearDivisor,
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
    const periodYearDivisor = isLeapYearInPeriod(periodStart, periodEnd) ? 366 : 365;
    const periodPenalty = (debt * rateInfo.rate * days) / (100 * periodYearDivisor);
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
    const periodYearDivisor = isLeapYearInPeriod(currentDate, end) ? 366 : 365;
    const periodPenalty = (debt * lastRate * days) / (100 * periodYearDivisor);
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
  const yearDivisor = isLeapYearInPeriod(start, end) ? 366 : 365;

  return {
    days: totalDays,
    penalty: Math.round(totalPenalty * 100) / 100,
    rate: sortedRates[0].rate,
    yearDivisor,
    breakdown
  };
}

export function calculateInterestOnDebt(
  debt: number,
  startDate: Date | string,
  endDate: Date | string,
  annualRate: number
): { interest: number; days: number; yearDivisor: number } {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const yearDivisor = isLeapYearInPeriod(start, end) ? 366 : 365;
  const interest = (debt * annualRate * days) / (100 * yearDivisor);
  
  return {
    interest: Math.round(interest * 100) / 100,
    days,
    yearDivisor
  };
}