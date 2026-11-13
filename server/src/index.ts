import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
  calculateDutyRequest, calculatePenaltyRequest, calculatePenaltyMultipleRequest,
  calculateInterest366Request, calculateInterest366MultipleRequest, ContractValidationError,
  getCaseTypesList, getEconomicCaseTypesList, getBaseValueInfo, getCurrentRefinancingRate,
  calendarDateSchema, today,
  type CaseTypesResponse, type ApiErrorResponse,
} from 'jurist-calculator-shared';
import { nbrbService } from './services/nbrbService';

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Validation and calculation use the same contracts as the client and shared core.
function calculation(handler: (input: unknown) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    try { res.json(handler(req.body)); } catch (error) { next(error); }
  };
}
app.post('/api/duty/calculate', calculation(calculateDutyRequest));
app.post('/api/penalty/calculate', calculation(calculatePenaltyRequest));
app.post('/api/penalty/calculate-multiple', calculation(calculatePenaltyMultipleRequest));
app.post('/api/interest/calculate-366', calculation(calculateInterest366Request));
app.post('/api/interest/calculate-366-multiple', calculation(calculateInterest366MultipleRequest));
app.get('/api/duty/case-types', (_req: Request, res: Response<CaseTypesResponse>) => {
  res.json({ common: getCaseTypesList(), economic: getEconomicCaseTypesList() });
});
app.get('/api/rates/base-value', (req: Request, res: Response, next: NextFunction) => {
  try { res.json(getBaseValueInfo(req.query.date === undefined ? today() : calendarDateSchema.parse(req.query.date))); }
  catch (error) { next(error); }
});
app.get('/api/rates/current', async (_req: Request, res: Response) => {
  const baseValue = getBaseValueInfo();
  try {
    const refinancing = await nbrbService.fetchRefinancingRate();
    res.json({ baseValue: baseValue.value, baseValueDate: baseValue.dateFrom, baseValueAct: baseValue.act,
      refinancingRate: refinancing.rate, refinancingRateDate: refinancing.date, updatedAt: new Date().toISOString() });
  } catch {
    res.json({ baseValue: baseValue.value, baseValueDate: baseValue.dateFrom, baseValueAct: baseValue.act,
      refinancingRate: getCurrentRefinancingRate(), refinancingRateDate: 'fallback', updatedAt: new Date().toISOString(), fallback: true });
  }
});
app.get('/api/rates/refinancing', async (_req: Request, res: Response) => {
  try {
    const result = await nbrbService.fetchRefinancingRate();
    res.json({ value: result.rate, date: result.date, type: 'annual' });
  } catch {
    res.json({ value: getCurrentRefinancingRate(), date: 'fallback', type: 'annual', fallback: true });
  }
});
app.use((error: unknown, _req: Request, res: Response<ApiErrorResponse>, _next: NextFunction) => {
  if (error instanceof ContractValidationError) {
    res.status(400).json({ error: error.message, issues: error.issues });
  } else if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'Некорректное тело JSON', issues: [{ path: 'request', message: 'Требуется корректный JSON-объект' }] });
  } else {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Ошибка расчёта' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
export default app;
