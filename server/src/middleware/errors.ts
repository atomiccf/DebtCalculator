import type { Request, Response, NextFunction } from 'express';
import { ContractValidationError, CalculationError, type ApiErrorResponse } from 'jurist-calculator-shared';

function sendError(res: Response<ApiErrorResponse>, status: number, message: string) {
  res.status(status).json({ error: message, issues: [{ path: 'request', message }] });
}

export function notFound(_req: Request, res: Response<ApiErrorResponse>) {
  sendError(res, 404, 'Маршрут не найден');
}

export function errorHandler(error: unknown, _req: Request, res: Response<ApiErrorResponse>, next: NextFunction) {
  if (res.headersSent) { next(error); return; }
  if (error instanceof ContractValidationError) {
    res.status(400).json({ error: error.message, issues: error.issues });
  } else if (error instanceof CalculationError) {
    sendError(res, 400, error.message);
  } else if (error && typeof error === 'object' && 'type' in error) {
    // Only body-parser errors describe client input; an internal SyntaxError is a 500.
    switch (error.type) {
      case 'entity.parse.failed': sendError(res, 400, 'Некорректное тело JSON'); return;
      case 'entity.too.large': sendError(res, 413, 'Тело запроса слишком велико'); return;
      case 'charset.unsupported': case 'encoding.unsupported':
        sendError(res, 415, 'Неподдерживаемая кодировка запроса'); return;
      case 'request.aborted': case 'request.size.invalid':
        sendError(res, 400, 'Некорректное тело запроса'); return;
      default: sendError(res, 500, 'Внутренняя ошибка сервера');
    }
  } else {
    sendError(res, 500, 'Внутренняя ошибка сервера');
  }
}
