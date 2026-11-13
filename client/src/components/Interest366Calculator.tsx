import { useState } from 'react'
import { interest366MultipleRequestSchema, type Interest366MultipleRequest, type Interest366MultipleResponse, type Interest366Response, type Interest366Basis, type AnnualDayCount } from 'jurist-calculator-shared'
import styles from './Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { useDocuments } from '../hooks/useDocuments'
import { DocumentForm, ResultsTable, FormField, NumericInput, ResultStatus } from './ui'
import { CalculationDetails } from './ui/CalculationDetails'
import { DayCountField } from './ui/DayCountField'
import { API_ENDPOINTS } from '../config/api'
import { parseNumericInput } from '../utils/numericInput'

export default function Interest366Calculator() {
  const { documents, addDocument, removeDocument, updateDocument } = useDocuments()
  const [calculationBasis, setBasis] = useState<Interest366Basis>('estimate')
  const [rateDate, setRateDate] = useState('')
  const [dayCount, setDayCount] = useState<AnnualDayCount | ''>('')
  const [hasPenalty, setHasPenalty] = useState(false)
  const [statutoryException, setException] = useState(false)
  const [refinancingRate, setRate] = useState('')
  const inputKey = JSON.stringify({ documents, calculationBasis, rateDate, dayCount, hasPenalty, statutoryException, refinancingRate })
  const { data, error, loading, stale, execute } = useApi<Interest366MultipleResponse, Interest366MultipleRequest>(API_ENDPOINTS.INTEREST_366_MULTIPLE, 'POST', { schema: interest366MultipleRequestSchema, inputKey })
  const multiYear = documents.some(d => d.startDate && d.endDate && d.startDate.slice(0, 4) !== d.endDate.slice(0, 4))
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const options = { documents: documents.map(doc => ({ ...doc, debt: parseNumericInput(doc.debt, true) })), hasPenalty, statutoryException: hasPenalty && statutoryException,
      ...(refinancingRate.trim() !== '' ? { refinancingRate: parseNumericInput(refinancingRate) } : {}) }
    const request: Interest366MultipleRequest = calculationBasis === 'estimate'
      ? { ...options, calculationBasis, ...(rateDate ? { rateDate } : {}), ...(dayCount !== '' ? { dayCount } : {}) }
      : { ...options, calculationBasis, rateDate, dayCount: dayCount as AnnualDayCount }
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
    { key: 'rateDate', header: 'Дата ставки' },
    { key: 'refinancingRate', header: 'Ставка', render: (v: unknown) => `${v}%` },
    { key: 'interest', header: 'Проценты', render: (v: unknown) => `${v} BYN` },
  ]
  return <div className={styles.calculator}>
    <h2>Проценты по ст.366 ГК РБ</h2>
    <p className={styles.calculatorDescription}>Первый и последний день просрочки включены в расчёт. Дата выбора ставки задаётся отдельно.</p>
    <form onSubmit={handleSubmit}>
      <FormField label="Основание расчёта"><select value={calculationBasis} onChange={e => setBasis(e.target.value as Interest366Basis)}>
        <option value="estimate">Предварительный расчёт</option><option value="payment">Оплата</option>
        <option value="judgment">Решение суда</option><option value="executive-endorsement">Исполнительная надпись</option>
      </select></FormField>
      <FormField label="Дата выбора ставки (дата оплаты, решения или надписи)"><input type="date" required={calculationBasis !== 'estimate'} value={rateDate} onChange={e => setRateDate(e.target.value)} /></FormField>
      <DayCountField value={dayCount} onChange={setDayCount} required={calculationBasis !== 'estimate' || multiYear} />
      <FormField label="Установлена неустойка"><select value={hasPenalty ? 'yes' : 'no'} onChange={e => setHasPenalty(e.target.value === 'yes')}>
        <option value="no">Нет</option><option value="yes">Да</option>
      </select></FormField>
      {hasPenalty && <label><input type="checkbox" required checked={statutoryException} onChange={e => setException(e.target.checked)} /> Установлено законодательное исключение для одновременного взыскания процентов</label>}
      <FormField label="Явная годовая ставка (%), если задана отдельно"><NumericInput value={refinancingRate} onChange={setRate} /></FormField>
      <p className={styles.calculatorDescription}>Если ставка не указана, она выбирается из справочника на дату выбора ставки. В предварительном расчёте без этой даты используется конец периода каждого документа.</p>
      <div className={styles.documentsHeader}><span>Документы</span><button type="button" className={styles.btnAdd} onClick={addDocument}>+ Добавить документ</button></div>
      <div className={styles.documentsList}>{documents.map((doc, index) => <DocumentForm key={index} document={doc} index={index} onChange={updateDocument} onRemove={removeDocument} canRemove={documents.length > 1} />)}</div>
      <button type="submit" className={styles.btn} disabled={loading}>{loading ? 'Расчёт...' : 'Рассчитать'}</button>
    </form>
    {data && <ResultStatus stale={stale} />}
    {results.length > 0 && <ResultsTable columns={columns} data={results} totalRow={[{ value: 'Итого', colSpan: 6 }, { value: `${data?.total} BYN` }]} />}
    {data && data.results.map((row, index) => <div key={index}><p>{row.name}</p><CalculationDetails calculation={row} /></div>)}
    {error && <div className={styles.error}>{error}</div>}
  </div>
}
