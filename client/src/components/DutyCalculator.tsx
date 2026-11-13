import { useState, useEffect } from 'react'
import { dutyRequestSchema, today, type DutyRequest, type DutyResponse, type CaseTypesResponse, type CourtType, type PlaintiffType, type CaseType, type EconomicCaseType, type EconomicCourtLevel } from 'jurist-calculator-shared'
import styles from './Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { FormField } from './ui'
import { CalculationDetails } from './ui/CalculationDetails'
import { API_ENDPOINTS } from '../config/api'

const courts: { value: CourtType; label: string }[] = [
  { value: 'common', label: 'Суд общей юрисдикции' },
  { value: 'economic', label: 'Экономический суд' },
  { value: 'appellate_economic', label: 'Апелляционный экономический суд' },
  { value: 'supreme_economic', label: 'Судебная коллегия по экономическим делам ВС РБ' },
]
const plaintiffs: { value: PlaintiffType; label: string }[] = [
  { value: 'individual', label: 'Физическое лицо' },
  { value: 'organization', label: 'Юридическое лицо' },
  { value: 'ip', label: 'Индивидуальный предприниматель' },
]
const complaints = ['appeal', 'cassation', 'supervision']

export default function DutyCalculator() {
  const [courtType, setCourtType] = useState<CourtType>('common')
  const [caseType, setCaseType] = useState('property')
  const [plaintiffType, setPlaintiffType] = useState<PlaintiffType>('individual')
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [originalCaseType, setOriginalCaseType] = useState('')
  const [originalCourtLevel, setOriginalCourtLevel] = useState<EconomicCourtLevel>('economic')
  const [administrativePenalty, setAdministrativePenalty] = useState<'fine' | 'other'>('fine')
  const [fineAmount, setFineAmount] = useState('')
  const [isRepeated, setIsRepeated] = useState(false)
  const { data: caseTypes, error: caseTypesError, execute: fetchCaseTypes } = useApi<CaseTypesResponse>(API_ENDPOINTS.DUTY_CASE_TYPES, 'GET')
  const { data, error, loading, execute } = useApi<DutyResponse, DutyRequest>(API_ENDPOINTS.DUTY_CALCULATE, 'POST', { schema: dutyRequestSchema })
  useEffect(() => { void fetchCaseTypes() }, [fetchCaseTypes])

  const common = courtType === 'common'
  const available = (common ? caseTypes?.common : caseTypes?.economic) ?? []
  const compatible = available.filter(ct => !ct.id.startsWith('non_property_') || ct.id === (plaintiffType === 'organization' ? 'non_property_org' : plaintiffType === 'ip' ? 'non_property_ip' : 'non_property_person'))
  const complaint = complaints.includes(caseType)
  const administrative = common && (caseType === 'administrative' || complaint && !amount && originalCaseType === 'administrative')
  const amountRequired = ['property', 'property_quality', 'court_order'].includes(caseType)
  const showOriginal = complaint && !amount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const basics = { date, amount: amountRequired || complaint ? (amount ? Number(amount) : undefined) : undefined }
    const original = showOriginal && originalCaseType ? originalCaseType : undefined
    const request: DutyRequest = common ? {
      ...basics, courtType: 'common', caseType: caseType as CaseType,
      plaintiffType: plaintiffType as 'individual' | 'organization',
      originalCaseType: original as Exclude<CaseType, 'appeal' | 'cassation' | 'supervision'> | undefined,
      ...(caseType === 'divorce' || original === 'divorce' ? { isRepeated } : {}),
      ...(administrative ? { administrativePenalty, ...(administrativePenalty === 'fine' ? { fineAmount: Number(fineAmount) } : {}) } : {}),
    } : {
      ...basics, courtType, caseType: caseType as EconomicCaseType, plaintiffType,
      originalCaseType: original as Exclude<EconomicCaseType, 'appeal' | 'cassation' | 'supervision'> | undefined,
      ...(showOriginal ? { originalCourtLevel } : {}),
    }
    await execute(request)
  }

  return <div className={styles.calculator}>
    <h2>Калькулятор государственной пошлины</h2>
    <form onSubmit={handleSubmit}>
      <FormField label="Тип суда"><select value={courtType} onChange={e => {
        const court = e.target.value as CourtType
        setCourtType(court); setCaseType('property'); setOriginalCaseType(''); setAmount('')
        if (court === 'common' && plaintiffType === 'ip') setPlaintiffType('individual')
      }}>{courts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></FormField>
      <FormField label="Тип заявителя"><select value={plaintiffType} onChange={e => {
        setPlaintiffType(e.target.value as PlaintiffType); setCaseType('property'); setOriginalCaseType('')
      }}>{plaintiffs.filter(p => !common || p.value !== 'ip').map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></FormField>
      <FormField label="Дата обращения в суд"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></FormField>
      <FormField label="Тип заявления"><select value={caseType} onChange={e => { setCaseType(e.target.value); setOriginalCaseType(''); setAmount('') }}>
        {compatible.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
      </select></FormField>
      {(amountRequired || complaint) && <FormField label={complaint ? 'Оспариваемая сумма (BYN), если требование имущественное' : 'Сумма требования (BYN)'}>
        <input type="number" required={amountRequired} min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
      </FormField>}
      {showOriginal && <>
        <FormField label="Исходное требование"><select required value={originalCaseType} onChange={e => setOriginalCaseType(e.target.value)}>
          <option value="">Выберите требование</option>
          {compatible.filter(ct => !complaints.includes(ct.id) && !['property', 'property_quality', 'court_order'].includes(ct.id)).map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
        </select></FormField>
        {!common && <FormField label="Суд исходного требования"><select value={originalCourtLevel} onChange={e => setOriginalCourtLevel(e.target.value as EconomicCourtLevel)}>
          {courts.filter(c => c.value !== 'common').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select></FormField>}
      </>}
      {common && (caseType === 'divorce' || showOriginal && originalCaseType === 'divorce') && <label><input type="checkbox" checked={isRepeated} onChange={e => setIsRepeated(e.target.checked)} /> Повторный брак</label>}
      {administrative && <>
        <FormField label="Административное взыскание"><select value={administrativePenalty} onChange={e => setAdministrativePenalty(e.target.value as 'fine' | 'other')}>
          <option value="fine">Штраф</option><option value="other">Иное взыскание</option>
        </select></FormField>
        {administrativePenalty === 'fine' && <FormField label="Размер штрафа (BYN)"><input type="number" required min="0.01" step="0.01" value={fineAmount} onChange={e => setFineAmount(e.target.value)} /></FormField>}
      </>}
      <button type="submit" className={styles.btn} disabled={loading}>{loading ? 'Расчёт...' : 'Рассчитать'}</button>
    </form>
    {data && <div className={styles.result}>
      <div className={styles.resultLabel}>Сумма государственной пошлины</div>
      <div className={styles.resultValue}>{data.amount} BYN</div>
      <div className={styles.resultBreakdown}>{data.breakdown}</div>
      <CalculationDetails calculation={data} />
    </div>}
    {(caseTypesError || error) && <div className={styles.error}>{caseTypesError || error}</div>}
  </div>
}
