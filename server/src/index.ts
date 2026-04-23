import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  calculateCommonCourtDuty,
  calculateEconomicCourtDuty,
  getCaseTypesList,
  getEconomicCaseTypesList,
  getBaseValue,
  getBaseValueInfo,
  getCurrentRefinancingRate,
  calculatePenalty,
  calculateInterestOnDebt,
  calculateInterest366,
  calculateInterest366Multiple,
  DutyCalculationInput,
  DutyCalculationResult,
  CaseType
} from 'jurist-calculator-shared';
import { fetchRefinancingRate } from 'jurist-calculator-shared';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/duty/calculate', (req: Request, res: Response) => {
  try {
    const input = req.body as DutyCalculationInput;
    
    if (!input.courtType || !input.caseType) {
      res.status(400).json({ error: 'Необходимо указать тип суда и тип дела' });
      return;
    }

    let result: DutyCalculationResult;
    const date = input.date ? new Date(input.date) : new Date();
    const baseValue = getBaseValue(date);

    switch (input.courtType) {
      case 'common':
        result = {
          amount: calculateCommonCourtDuty(
            { caseType: input.caseType as CaseType, plaintiffType: input.plaintiffType as 'individual' | 'organization' },
            input.amount,
            date
          ),
          baseValue,
          breakdown: 'Суд общей юрисдикции'
        };
        break;
        
      case 'economic':
      case 'supreme_economic':
        result = {
          amount: calculateEconomicCourtDuty(
            { 
              caseType: input.caseType as any, 
              plaintiffType: input.plaintiffType as any, 
              courtLevel: input.courtType === 'supreme_economic' ? 'supreme_economic' : 'economic'
            },
            input.amount,
            date
          ),
          baseValue,
          breakdown: input.courtType === 'supreme_economic' 
            ? 'Судебная коллегия по экономическим делам ВС РБ'
            : 'Экономический суд'
        };
        break;
        
      default:
        res.status(400).json({ error: 'Тип суда не поддерживается' });
        return;
    }

    result.amount = Math.round(result.amount * 100) / 100;
    res.json(result);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка расчёта';
    res.status(400).json({ error: message });
  }
});

app.get('/api/duty/case-types', (_req: Request, res: Response) => {
  res.json({
    common: getCaseTypesList(),
    economic: getEconomicCaseTypesList()
  });
});

app.get('/api/rates/base-value', (req: Request, res: Response) => {
  const date = req.query.date ? new Date(req.query.date as string) : new Date();
  res.json(getBaseValueInfo(date));
});

app.get('/api/rates/current', async (_req: Request, res: Response) => {
  try {
    const refinancing = await fetchRefinancingRate();
    const baseValue = getBaseValueInfo();
    
    res.json({
      baseValue: baseValue.value,
      baseValueDate: baseValue.dateFrom,
      baseValueAct: baseValue.act,
      refinancingRate: refinancing.rate,
      refinancingRateDate: refinancing.date,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    const fallbackRefinancing = getCurrentRefinancingRate();
    const baseValue = getBaseValueInfo();
    
    res.json({
      baseValue: baseValue.value,
      baseValueDate: baseValue.dateFrom,
      baseValueAct: baseValue.act,
      refinancingRate: fallbackRefinancing,
      refinancingRateDate: 'fallback',
      updatedAt: new Date().toISOString(),
      fallback: true
    });
  }
});

app.get('/api/rates/refinancing', async (_req: Request, res: Response) => {
  try {
    const result = await fetchRefinancingRate();
    res.json({ 
      value: result.rate,
      date: result.date,
      type: 'annual'
    });
  } catch (error) {
    res.json({ 
      value: getCurrentRefinancingRate(),
      date: 'fallback',
      type: 'annual',
      fallback: true
    });
  }
});

app.post('/api/penalty/calculate', (req: Request, res: Response) => {
  try {
    const { debt, startDate, endDate, rate, annualRate } = req.body;
    
    if (!debt || !startDate || !endDate) {
      res.status(400).json({ error: 'Необходимо указать сумму долга, даты начала и окончания' });
      return;
    }

    if (annualRate) {
      const interestResult = calculateInterestOnDebt(debt, startDate, endDate, annualRate);
      res.json({
        type: 'interest',
        debt,
        startDate,
        endDate,
        annualRate,
        amount: interestResult.interest,
        days: interestResult.days,
        yearDivisor: interestResult.yearDivisor
      });
    } else {
      const result = calculatePenalty({ debt, startDate, endDate, rate });
      res.json({
        type: 'penalty',
        ...result
      });
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка расчёта';
    res.status(400).json({ error: message });
  }
});

app.post('/api/penalty/calculate-multiple', (req: Request, res: Response) => {
  try {
    const { documents, rate, annualRate } = req.body;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({ error: 'Необходимо указать список документов' });
      return;
    }

    const rateValue = rate || 0.1;
    const results: { name: string; debt: number; startDate: string; endDate: string; days: number; penalty: number }[] = [];
    let totalPenalty = 0;

    for (const doc of documents) {
      if (!doc.name || !doc.name.trim()) {
        res.status(400).json({ error: 'Укажите название для каждого документа' });
        return;
      }
      if (!doc.debt || doc.debt <= 0) {
        res.status(400).json({ error: 'Сумма долга должна быть больше 0' });
        return;
      }
      if (!doc.startDate || !doc.endDate) {
        res.status(400).json({ error: 'Укажите даты начала и окончания для каждого документа' });
        return;
      }

      let docPenalty: number;
      let docYearDivisor: number;
      if (annualRate) {
        const interestResult = calculateInterestOnDebt(doc.debt, doc.startDate, doc.endDate, annualRate);
        docPenalty = interestResult.interest;
        docYearDivisor = interestResult.yearDivisor;
      } else {
        const result = calculatePenalty({ debt: doc.debt, startDate: doc.startDate, endDate: doc.endDate, rate: rateValue });
        docPenalty = result.penalty;
        docYearDivisor = result.yearDivisor;
      }

      const start = new Date(doc.startDate);
      const end = new Date(doc.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      results.push({
        name: doc.name,
        debt: doc.debt,
        startDate: doc.startDate,
        endDate: doc.endDate,
        days,
        penalty: docPenalty
      });
      totalPenalty += docPenalty;
    }

    res.json({
      results,
      total: Math.round(totalPenalty * 100) / 100,
      rate: rateValue,
      type: annualRate ? 'interest' : 'penalty'
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка расчёта';
    res.status(400).json({ error: message });
  }
});

app.post('/api/interest/calculate-366', (req: Request, res: Response) => {
  try {
    const { debt, startDate, endDate } = req.body;
    
    if (!debt || debt <= 0) {
      res.status(400).json({ error: 'Необходимо указать сумму долга' });
      return;
    }
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Необходимо указать даты начала и окончания периода' });
      return;
    }

    const result = calculateInterest366({ debt, startDate, endDate });
    res.json(result);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка расчёта';
    res.status(400).json({ error: message });
  }
});

app.post('/api/interest/calculate-366-multiple', (req: Request, res: Response) => {
  try {
    const { documents } = req.body;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({ error: 'Необходимо указать список документов' });
      return;
    }

    const result = calculateInterest366Multiple(documents);
    res.json(result);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка расчёта';
    res.status(400).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;