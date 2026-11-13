import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
  calculateDutyService, calculatePenaltyService, calculatePenaltyMultipleService,
  calculateInterest366Service, calculateInterest366MultipleService,
  dutyRequestSchema, penaltyRequestSchema, penaltyMultipleRequestSchema,
  interest366RequestSchema, interest366MultipleRequestSchema,
  getCaseTypesList, getEconomicCaseTypesList, getBaseValueInfo, getCurrentRefinancingRate,
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
  app.get('/api/rates/current', asyncRoute(async (_req: Request, res: Response) => {
    const baseValue = getBaseValueInfo();
    try {
      const refinancing = await nbrbService.fetchRefinancingRate();
      res.json({ baseValue: baseValue.value, baseValueDate: baseValue.dateFrom, baseValueAct: baseValue.act,
        refinancingRate: refinancing.rate, refinancingRateDate: refinancing.date, updatedAt: new Date().toISOString() });
    } catch {
      res.json({ baseValue: baseValue.value, baseValueDate: baseValue.dateFrom, baseValueAct: baseValue.act,
        refinancingRate: getCurrentRefinancingRate(), refinancingRateDate: 'fallback', updatedAt: new Date().toISOString(), fallback: true });
    }
  }));
  app.get('/api/rates/refinancing', asyncRoute(async (_req: Request, res: Response) => {
    try {
      const result = await nbrbService.fetchRefinancingRate();
      res.json({ value: result.rate, date: result.date, type: 'annual' });
    } catch {
      res.json({ value: getCurrentRefinancingRate(), date: 'fallback', type: 'annual', fallback: true });
    }
  }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
