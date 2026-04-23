import { useState } from 'react'
import styles from '../components/Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { useDocuments } from '../hooks/useDocuments'
import { DocumentForm, ResultsTable, FormField } from '../components/ui'
import { API_ENDPOINTS } from '../config/api'

interface DocumentResult {
  name: string
  debt: number
  startDate: string
  endDate: string
  days: number
  penalty: number
}

interface PenaltyResult {
  results: DocumentResult[]
  total: number
  rate: number
}

export default function PenaltyCalculator() {
  const [rate, setRate] = useState('')
  const { documents, addDocument, removeDocument, updateDocument } = useDocuments()
  const { data, error, loading, execute } = useApi<PenaltyResult>(API_ENDPOINTS.PENALTY_CALCULATE_MULTIPLE)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await execute({
      documents,
      rate: rate ? parseFloat(rate) : undefined
    })
  }

  const results = data?.results as unknown as Record<string, unknown>[] ?? []
  const total = data?.total ?? 0
  const resultRate = data?.rate ?? 0

  const columns = [
    { key: 'name', header: 'Документ' },
    { key: 'debt', header: 'Сумма', render: (v: unknown) => `${v} BYN` },
    { key: 'startDate', header: 'Период', render: (_: unknown, row: unknown) => {
      const r = row as DocumentResult
      return `${r.startDate} — ${r.endDate}`
    }},
    { key: 'days', header: 'Дней' },
    { key: 'penalty', header: 'Пени', render: (v: unknown) => `${v} BYN` },
  ]

  const totalRow = [
    { value: 'Итого', colSpan: 4 },
    { value: `${total} BYN` },
  ]

  return (
    <div className={styles.calculator}>
      <h2>Калькулятор пени</h2>
      
      <form onSubmit={handleSubmit}>
        <div className={styles.documentsHeader}>
          <span>Документы</span>
          <button type="button" className={styles.btnAdd} onClick={addDocument}>
            + Добавить документ
          </button>
        </div>

        <div className={styles.documentsList}>
          {documents.map((doc, index) => (
            <DocumentForm
              key={index}
              document={doc}
              index={index}
              onChange={updateDocument}
              onRemove={removeDocument}
              canRemove={documents.length > 1}
            />
          ))}
        </div>

        <FormField label="Ставка пени (% в день, по умолчанию 0.1%)">
          <input 
            type="number" 
            value={rate} 
            onChange={(e) => setRate(e.target.value)}
            placeholder="0.1"
            min="0"
            step="0.01"
          />
        </FormField>

        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? 'Расчёт...' : 'Рассчитать'}
        </button>
      </form>

      {results.length > 0 && (
        <ResultsTable columns={columns} data={results} totalRow={totalRow} />
      )}

      {results.length > 0 && (
        <div className={styles.resultsSummary}>
          Ставка: {resultRate}% в день
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}