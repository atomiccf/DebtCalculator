import { useState, useCallback } from 'react'
import { API_URL } from '../config/api'

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
}

interface UseApiState<T> {
  data: T | null
  error: string
  loading: boolean
}

type UseApiReturn<T> = UseApiState<T> & {
  execute: (body?: unknown) => Promise<T | null>
  reset: () => void
}

export function useApi<T>(endpoint: string, method: 'GET' | 'POST' = 'POST', options?: UseApiOptions<T>): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: '',
    loading: false,
  })

  const execute = useCallback(async (body?: unknown) => {
    setState(prev => ({ ...prev, error: '', loading: true }))

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка расчёта')
      }

      setState({ data, error: '', loading: false })
      options?.onSuccess?.(data as T)
      return data as T
    } catch (err) {
      const errorMessage = 
        err instanceof TypeError && err.message.includes('fetch')
          ? 'Ошибка соединения с сервером. Убедитесь, что сервер запущен на порту 3000.'
          : err instanceof Error 
            ? err.message 
            : 'Ошибка расчёта'
      
      setState({ data: null, error: errorMessage, loading: false })
      options?.onError?.(errorMessage)
      return null
    }
  }, [endpoint, method, options])

  return {
    ...state,
    execute,
    reset: () => setState({ data: null, error: '', loading: false }),
  }
}