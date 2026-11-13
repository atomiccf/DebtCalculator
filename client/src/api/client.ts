import type { RequestSchema } from 'jurist-calculator-shared'
import { API_URL } from '../config/api'
import { ApiError, parseApiErrorResponse, toApiError } from './errors'

export const DEFAULT_API_TIMEOUT_MS = 30_000

interface ApiRequestOptions<B> {
  method?: 'GET' | 'POST'
  body?: B
  schema?: RequestSchema<B>
  signal?: AbortSignal
  timeoutMs?: number
}

export async function apiRequest<T, B = unknown>(endpoint: string, options: ApiRequestOptions<B> = {}): Promise<T> {
  const { method = 'POST', schema, signal, timeoutMs = DEFAULT_API_TIMEOUT_MS } = options
  const controller = new AbortController()
  const abort = () => controller.abort(new ApiError('Запрос отменён', 'aborted'))
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    if (signal?.aborted) abort()
    signal?.addEventListener('abort', abort, { once: true })
    controller.signal.throwIfAborted()
    const body = schema ? schema.parse(options.body) : options.body
    const serializedBody = body === undefined ? undefined : JSON.stringify(body)
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Таймаут запроса должен быть положительным числом')
    timer = setTimeout(() => controller.abort(new ApiError('Время ожидания ответа API истекло. Повторите запрос.', 'timeout')), timeoutMs)

    let response: Response
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: serializedBody,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ApiError('Ошибка соединения с API. Проверьте доступность сервера и настройку адреса API.', 'network')
      }
      throw error
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      if (!response.ok) throw parseApiErrorResponse(undefined, response.status)
      throw new ApiError('Некорректный ответ API', 'invalid-response', [], response.status)
    }
    controller.signal.throwIfAborted()
    if (!response.ok) throw parseApiErrorResponse(data, response.status)
    return data as T
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason
    throw toApiError(error)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
