import styles from '../components/Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { useDocuments } from '../hooks/useDocuments'
import { DocumentForm, ResultsTable } from '../components/ui'
import { API_ENDPOINTS } from '../config/api'

interface DocumentResult {
  name: string
  debt: number
  startDate: string
  endDate: string
  days: number
  refinancingRate: number
  interest: number
}

interface InterestResult {
  results: DocumentResult[]
  total: number
}

export default function Interest366Calculator() {
  const { documents, addDocument, removeDocument, updateDocument } = useDocuments()
  const { data, error, loading, execute } = useApi<InterestResult>(API_ENDPOINTS.INTEREST_366_MULTIPLE)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await execute({ documents })
  }

  const results = data?.results as unknown as Record<string, unknown>[] ?? []
  const total = data?.total ?? 0

  const columns = [
    { key: 'name', header: 'Документ' },
    { key: 'debt', header: 'Сумма', render: (v: unknown) => `${v} BYN` },
    { key: 'startDate', header: 'Период', render: (_: unknown, row: unknown) => {
      const r = row as DocumentResult
      return `${r.startDate} — ${r.endDate}`
    }},
    { key: 'days', header: 'Дней' },
    { key: 'refinancingRate', header: 'Ставка', render: (v: unknown) => `${v}%` },
    { key: 'interest', header: 'Проценты', render: (v: unknown) => `${v} BYN` },
  ]

  const totalRow = [
    { value: 'Итого', colSpan: 5 },
    { value: `${total} BYN` },
  ]

  return (
    <div className={styles.calculator}>
      <h2>Проценты по ст.366 ГК РБ</h2>
      <p className={styles.calculatorDescription}>
        Расчёт процентов за пользование чужими денежными средствами по ставке рефинансирования Нацбанка Республики Беларусь
      </p>
      
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

        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? 'Расчёт...' : 'Рассчитать'}
        </button>
      </form>

      {results.length > 0 && (
        <ResultsTable columns={columns} data={results} totalRow={totalRow} />
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}