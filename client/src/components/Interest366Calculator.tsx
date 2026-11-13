import { interest366MultipleRequestSchema, splitPeriodByYear, type Interest366MultipleRequest, type Interest366MultipleResponse, type Interest366Response } from 'jurist-calculator-shared'
import styles from './Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { useDocuments } from '../hooks/useDocuments'
import { DocumentForm, ResultsTable, ResultStatus } from './ui'
import { CalculationDetails } from './ui/CalculationDetails'
import { API_ENDPOINTS } from '../config/api'
import { parseNumericInput } from '../utils/numericInput'

export default function Interest366Calculator() {
  const { documents, addDocument, removeDocument, updateDocument } = useDocuments()
  const inputKey = JSON.stringify({ documents })
  const { data, error, loading, stale, execute } = useApi<Interest366MultipleResponse, Interest366MultipleRequest>(API_ENDPOINTS.INTEREST_366_MULTIPLE, 'POST', { schema: interest366MultipleRequestSchema, inputKey })
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const request: Interest366MultipleRequest = {
      documents: documents.map(doc => ({ ...doc, debt: parseNumericInput(doc.debt, true) })),
      calculationBasis: 'estimate', hasPenalty: false, dayCount: 'actual/actual',
    }
    await execute(request)
  }
  const results = data?.results as unknown as Record<string, unknown>[] ?? []
  const columns = [
    { key: 'name', header: 'Документ' },
    { key: 'debt', header: 'Сумма', render: (v: unknown) => `${v} BYN` },
    { key: 'startDate', header: 'Период', render: (_: unknown, row: unknown) => {
      const r = row as Interest366Response
      return `${r.startDate} — ${r.endDate}`
    } },
    { key: 'days', header: 'Дней' },
    { key: 'dayCount', header: 'Дней в году', render: (_: unknown, row: unknown) => {
      const r = row as Interest366Response
      return splitPeriodByYear(r.startDate, r.endDate)
        .map(period => `${period.startDate.slice(0, 4)} — ${period.yearDivisor}`).join('; ')
    } },
    { key: 'rateDate', header: 'Дата ставки' },
    { key: 'refinancingRate', header: 'Ставка', render: (v: unknown) => `${v}%` },
    { key: 'interest', header: 'Проценты', render: (v: unknown) => `${v} BYN` },
  ]
  return <div className={styles.calculator}>
    <h2>Проценты по ст.366 ГК РБ</h2>
    <p className={styles.calculatorDescription}>Первый и последний день просрочки включены в расчёт. Последний день периода — дата оплаты, решения суда или исполнительной надписи. Если указана промежуточная дата до этого события, расчёт предварительный.</p>
    <form onSubmit={handleSubmit}>
      <p className={styles.calculatorDescription}>Для каждого документа ставка рефинансирования выбирается на последний день его периода и применяется ко всему периоду просрочки. Количество дней в году учитывается автоматически: 365 или 366 для каждого года периода.</p>
      <div className={styles.documentsHeader}><span>Документы</span><button type="button" className={styles.btnAdd} onClick={addDocument}>+ Добавить документ</button></div>
      <div className={styles.documentsList}>{documents.map((doc, index) => <DocumentForm key={index} document={doc} index={index} onChange={updateDocument} onRemove={removeDocument} canRemove={documents.length > 1} />)}</div>
      <button type="submit" className={styles.btn} disabled={loading}>{loading ? 'Расчёт...' : 'Рассчитать'}</button>
    </form>
    {data && <ResultStatus stale={stale} />}
    {results.length > 0 && <ResultsTable columns={columns} data={results} totalRow={[{ value: 'Итого', colSpan: 7 }, { value: `${data?.total} BYN` }]} />}
    {data && data.results.map((row, index) => <div key={index}><p>{row.name}</p><CalculationDetails calculation={row} /></div>)}
    {error && <div className={styles.error}>{error}</div>}
  </div>
}
