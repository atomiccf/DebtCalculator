import { useState } from 'react'
import { penaltyMultipleRequestSchema, type PenaltyMultipleRequest, type PenaltyMultipleResponse, type PenaltyDocumentResponse } from 'jurist-calculator-shared'
import styles from '../components/Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { useDocuments } from '../hooks/useDocuments'
import { DocumentForm, ResultsTable, FormField, NumericInput, ResultStatus } from '../components/ui'
import { API_ENDPOINTS } from '../config/api'
import { CalculationDetails } from './ui/CalculationDetails'
import { parseNumericInput } from '../utils/numericInput'

export default function PenaltyCalculator() {
  const [rate, setRate] = useState('')
  const { documents, addDocument, removeDocument, updateDocument } = useDocuments()
  const inputKey = JSON.stringify({ documents, rate })
  const { data, error, loading, stale, execute } = useApi<PenaltyMultipleResponse, PenaltyMultipleRequest>(API_ENDPOINTS.PENALTY_CALCULATE_MULTIPLE, 'POST', { schema: penaltyMultipleRequestSchema, inputKey })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await execute({ documents: documents.map(doc => ({ ...doc, debt: parseNumericInput(doc.debt, true) })), rate: parseNumericInput(rate) })
  }

  const results = data?.results as unknown as Record<string, unknown>[] ?? []
  const total = data?.total ?? 0
  const resultRate = data?.rate ?? 0

  const columns = [
    { key: 'name', header: 'Документ' },
    { key: 'debt', header: 'Сумма', render: (v: unknown) => `${v} BYN` },
    { key: 'startDate', header: 'Период', render: (_: unknown, row: unknown) => {
      const r = row as PenaltyDocumentResponse
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

        <FormField label="Ставка, % в день">
          <NumericInput
            value={rate} 
            onChange={setRate}
            required
          />
        </FormField>

        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? 'Расчёт...' : 'Рассчитать'}
        </button>
      </form>

      {data && <ResultStatus stale={stale} />}
      {results.length > 0 && (
        <ResultsTable columns={columns} data={results} totalRow={totalRow} />
      )}

      {results.length > 0 && (
        <div className={styles.resultsSummary}>
          Ставка: {resultRate}% в день
          {data && <CalculationDetails calculation={data} />}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
