import { useState, useCallback, useEffect, useRef } from 'react'
import type { RequestSchema, ValidationIssue } from 'jurist-calculator-shared'
import { apiRequest } from '../api/client'
import { toApiError, type ApiError } from '../api/errors'

interface UseApiOptions<T, B> {
  onSuccess?: (data: T) => void
  onError?: (error: string, details: ApiError) => void
  schema?: RequestSchema<B>
  inputKey?: string
  timeoutMs?: number
}

interface UseApiState<T> {
  data: T | null
  error: string
  issues: ValidationIssue[]
  loading: boolean
  resultKey?: string
}

type UseApiReturn<T, B> = UseApiState<T> & {
  stale: boolean
  execute: (body?: B) => Promise<T | null>
  cancel: () => void
  reset: () => void
}

export function useApi<T, B = unknown>(endpoint: string, method: 'GET' | 'POST' = 'POST', options?: UseApiOptions<T, B>): UseApiReturn<T, B> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: '',
    issues: [],
    loading: false,
  })
  const activeRequest = useRef<AbortController | null>(null)

  const abortRequest = useCallback(() => {
    const controller = activeRequest.current
    activeRequest.current = null
    controller?.abort()
  }, [])

  useEffect(() => abortRequest, [abortRequest])

  const cancel = useCallback(() => {
    abortRequest()
    setState(prev => ({ ...prev, error: '', issues: [], loading: false }))
  }, [abortRequest])

  const reset = useCallback(() => {
    abortRequest()
    setState({ data: null, error: '', issues: [], loading: false })
  }, [abortRequest])

  const schema = options?.schema
  const onSuccess = options?.onSuccess
  const onError = options?.onError
  const inputKey = options?.inputKey
  const timeoutMs = options?.timeoutMs
  const execute = useCallback(async (body?: B) => {
    abortRequest()
    const controller = new AbortController()
    activeRequest.current = controller
    setState(prev => ({ ...prev, error: '', issues: [], loading: true }))

    let data: T
    try {
      data = await apiRequest<T, B>(endpoint, {
        method, body, schema, signal: controller.signal, timeoutMs,
      })
    } catch (err) {
      if (activeRequest.current !== controller) return null
      activeRequest.current = null
      const error = toApiError(err)
      setState({ data: null, error: error.message, issues: error.issues, loading: false })
      onError?.(error.message, error)
      return null
    }

    if (activeRequest.current !== controller) return null
    activeRequest.current = null
    setState({ data, error: '', issues: [], loading: false, resultKey: inputKey })
    onSuccess?.(data)
    return data
  }, [endpoint, method, schema, onSuccess, onError, inputKey, timeoutMs, abortRequest])

  return {
    ...state,
    stale: state.data !== null && state.resultKey !== inputKey,
    execute,
    cancel,
    reset,
  }
}
