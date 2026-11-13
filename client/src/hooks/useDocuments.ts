import { useState, useCallback } from 'react'
import type { CalculationDocument } from 'jurist-calculator-shared'

export interface Document extends CalculationDocument {
  [key: string]: string | number
}

export interface UseDocumentsOptions {
  initialCount?: number
}

const emptyDocument: Document = {
  name: '',
  debt: 0,
  startDate: '',
  endDate: '',
}

export function useDocuments(options?: UseDocumentsOptions) {
  const initialCount = options?.initialCount ?? 1
  const [documents, setDocuments] = useState<Document[]>(
    Array(initialCount).fill(null).map(() => ({ ...emptyDocument }))
  )

  const addDocument = useCallback(() => {
    setDocuments(prev => [...prev, { ...emptyDocument }])
  }, [])

  const removeDocument = useCallback((index: number) => {
    setDocuments(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const updateDocument = useCallback(
    (index: number, field: string, value: string | number) => {
      setDocuments(prev => {
        const updated = [...prev]
        updated[index] = { ...updated[index], [field]: value }
        return updated
      })
    },
    []
  )

  return {
    documents,
    addDocument,
    removeDocument,
    updateDocument,
    setDocuments,
  }
}
