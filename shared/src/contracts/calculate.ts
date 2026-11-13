import { dutyRequestSchema, penaltyRequestSchema, penaltyMultipleRequestSchema, interest366RequestSchema, interest366MultipleRequestSchema } from './schemas';
import { calculateDutyService, calculatePenaltyService, calculatePenaltyMultipleService, calculateInterest366Service, calculateInterest366MultipleService } from '../services';
import type { DutyResponse, PenaltyResponse, PenaltyMultipleResponse, Interest366Response, Interest366MultipleResponse } from './types';

// Compatibility entry points: validation and orchestration remain separate.
export function calculateDutyRequest(value: unknown): DutyResponse {
  return calculateDutyService(dutyRequestSchema.parse(value));
}
export function calculatePenaltyRequest(value: unknown): PenaltyResponse {
  return calculatePenaltyService(penaltyRequestSchema.parse(value));
}
export function calculatePenaltyMultipleRequest(value: unknown): PenaltyMultipleResponse {
  return calculatePenaltyMultipleService(penaltyMultipleRequestSchema.parse(value));
}
export function calculateInterest366Request(value: unknown): Interest366Response {
  return calculateInterest366Service(interest366RequestSchema.parse(value));
}
export function calculateInterest366MultipleRequest(value: unknown): Interest366MultipleResponse {
  return calculateInterest366MultipleService(interest366MultipleRequestSchema.parse(value));
}
