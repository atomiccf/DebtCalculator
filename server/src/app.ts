import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
  calculateDutyService, calculatePenaltyService, calculatePenaltyMultipleService,
  calculateInterest366Service, calculateInterest366MultipleService,
  dutyRequestSchema, penaltyRequestSchema, penaltyMultipleRequestSchema,
  interest366RequestSchema, interest366MultipleRequestSchema,
  getCaseTypesList, getEconomicCaseTypesList, getBaseValueInfo,
  calendarDateSchema, today,
  type CaseTypesResponse, type RequestSchema,
} from 'jurist-calculator-shared';
import { nbrbService } from './services/nbrbService';
import { errorHandler, notFound } from './middleware/errors';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Validation and calculation use the same contracts as the client and shared core.
  function calculation<T>(schema: RequestSchema<T>, service: (input: T) => unknown) {
    return (req: Request, res: Response, next: NextFunction) => {
      try { res.json(service(schema.parse(req.body))); } catch (error) { next(error); }
    };
  }
  function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
      handler(req, res).catch(next);
    };
  }
  app.post('/api/duty/calculate', calculation(dutyRequestSchema, calculateDutyService));
  app.post('/api/penalty/calculate', calculation(penaltyRequestSchema, calculatePenaltyService));
  app.post('/api/penalty/calculate-multiple', calculation(penaltyMultipleRequestSchema, calculatePenaltyMultipleService));
  app.post('/api/interest/calculate-366', calculation(interest366RequestSchema, calculateInterest366Service));
  app.post('/api/interest/calculate-366-multiple', calculation(interest366MultipleRequestSchema, calculateInterest366MultipleService));
  app.get('/api/duty/case-types', (_req: Request, res: Response<CaseTypesResponse>) => {
    res.json({ common: getCaseTypesList(), economic: getEconomicCaseTypesList() });
  });
  app.get('/api/rates/base-value', (req: Request, res: Response, next: NextFunction) => {
    try { res.json(getBaseValueInfo(req.query.date === undefined ? today() : calendarDateSchema.parse(req.query.date))); }
    catch (error) { next(error); }
  });
  app.get('/api/rates/current', asyncRoute(async (req: Request, res: Response) => {
    const selectedOn = req.query.date === undefined ? today() : calendarDateSchema.parse(req.query.date);
    const baseValue = getBaseValueInfo(selectedOn);
    const refinancing = await nbrbService.getRefinancingRateForDate(selectedOn);
    res.json({ baseValue: baseValue.value, baseValueDate: baseValue.dateFrom, baseValueAct: baseValue.act,
      refinancingRate: refinancing.rate, refinancingRateDate: refinancing.date,
      referenceData: { baseValue: { selectedOn, record: baseValue }, refinancingRate: refinancing },
      fallback: refinancing.fallback, warnings: refinancing.warnings, updatedAt: new Date().toISOString() });
  }));
  app.get('/api/rates/refinancing', asyncRoute(async (req: Request, res: Response) => {
    const selectedOn = req.query.date === undefined ? today() : calendarDateSchema.parse(req.query.date);
    const result = await nbrbService.getRefinancingRateForDate(selectedOn);
    res.json({ ...result, value: result.rate, type: 'annual' });
  }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
