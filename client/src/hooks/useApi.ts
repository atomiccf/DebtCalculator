import { useState, useCallback } from 'react'
import { API_URL } from '../config/api'
import type { RequestSchema } from 'jurist-calculator-shared'

interface UseApiOptions<T, B> {
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
  schema?: RequestSchema<B>
  inputKey?: string
}

interface UseApiState<T> {
  data: T | null
  error: string
  loading: boolean
  resultKey?: string
}

type UseApiReturn<T, B> = UseApiState<T> & {
  stale: boolean
  execute: (body?: B) => Promise<T | null>
  reset: () => void
}

export function useApi<T, B = unknown>(endpoint: string, method: 'GET' | 'POST' = 'POST', options?: UseApiOptions<T, B>): UseApiReturn<T, B> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: '',
    loading: false,
  })

  const schema = options?.schema
  const onSuccess = options?.onSuccess
  const onError = options?.onError
  const inputKey = options?.inputKey
  const execute = useCallback(async (body?: B) => {
    setState(prev => ({ ...prev, error: '', loading: true }))

    try {
      const validatedBody = schema ? schema.parse(body) : body
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: validatedBody === undefined ? undefined : JSON.stringify(validatedBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка расчёта')
      }

      setState({ data, error: '', loading: false, resultKey: inputKey })
      onSuccess?.(data as T)
      return data as T
    } catch (err) {
      const errorMessage = 
        err instanceof TypeError && err.message.includes('fetch')
          ? 'Ошибка соединения с API. Проверьте доступность сервера и настройку адреса API.'
          : err instanceof Error 
            ? err.message 
            : 'Ошибка расчёта'
      
      setState({ data: null, error: errorMessage, loading: false })
      onError?.(errorMessage)
      return null
    }
  }, [endpoint, method, schema, onSuccess, onError, inputKey])

  return {
    ...state,
    stale: state.data !== null && state.resultKey !== inputKey,
    execute,
    reset: () => setState({ data: null, error: '', loading: false }),
  }
}
