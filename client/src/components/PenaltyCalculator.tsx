import { useState } from 'react'
import { penaltyMultipleRequestSchema, type PenaltyMultipleRequest, type PenaltyMultipleResponse, type PenaltyDocumentResponse, type AnnualDayCount } from 'jurist-calculator-shared'
import styles from '../components/Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { useDocuments } from '../hooks/useDocuments'
import { DocumentForm, ResultsTable, FormField } from '../components/ui'
import { API_ENDPOINTS } from '../config/api'
import { CalculationDetails } from './ui/CalculationDetails'
import { DayCountField } from './ui/DayCountField'

export default function PenaltyCalculator() {
  const [rate, setRate] = useState('')
  const [annual, setAnnual] = useState(false)
  const [dayCount, setDayCount] = useState<AnnualDayCount | ''>('')
  const { documents, addDocument, removeDocument, updateDocument } = useDocuments()
  const { data, error, loading, execute } = useApi<PenaltyMultipleResponse, PenaltyMultipleRequest>(API_ENDPOINTS.PENALTY_CALCULATE_MULTIPLE, 'POST', { schema: penaltyMultipleRequestSchema })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await execute(annual
      ? { documents, annualRate: rate === '' ? NaN : Number(rate), dayCount: dayCount as AnnualDayCount }
      : { documents, rate: rate === '' ? NaN : Number(rate) })
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

        <FormField label="Тип ставки"><select value={annual ? 'annual' : 'daily'} onChange={e => setAnnual(e.target.value === 'annual')}>
          <option value="daily">Дневная</option><option value="annual">Годовая</option>
        </select></FormField>
        {annual && <DayCountField value={dayCount} onChange={setDayCount} required />}
        <FormField label={annual ? 'Ставка (% в год)' : 'Ставка пени (% в день)'}>
          <input 
            type="number" 
            value={rate} 
            onChange={(e) => setRate(e.target.value)}
            required
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
          Ставка: {resultRate}% {data?.type === 'interest' ? 'в год' : 'в день'}
          {data && <CalculationDetails calculation={data} />}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
