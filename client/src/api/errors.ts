import { ContractValidationError, type ApiErrorResponse, type ValidationIssue } from 'jurist-calculator-shared'

type ApiErrorKind = 'http' | 'validation' | 'network' | 'invalid-response' | 'timeout' | 'aborted' | 'unknown'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly issues: ValidationIssue[] = [],
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function parseApiErrorResponse(value: unknown, status: number): ApiError {
  const response = value && typeof value === 'object' ? value as Partial<ApiErrorResponse> : undefined
  const issues = Array.isArray(response?.issues) ? response.issues.filter((issue): issue is ValidationIssue =>
    issue !== null && typeof issue === 'object' && typeof issue.path === 'string' && typeof issue.message === 'string',
  ) : []
  const message = typeof response?.error === 'string' && response.error.trim() ? response.error : 'Ошибка расчёта'
  return new ApiError(message, 'http', issues, status)
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof ContractValidationError) return new ApiError(error.message, 'validation', error.issues)
  return new ApiError(error instanceof Error ? error.message : 'Ошибка расчёта', 'unknown')
}
