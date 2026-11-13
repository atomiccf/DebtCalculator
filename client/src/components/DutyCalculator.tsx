import { useState, useEffect } from 'react'
import {
  dutyRequestSchema, today, getDutyRequirements, getDutyPlaintiffTypes, getDutyOriginalCourtLevels,
  isDutyCaseAvailable, isDutyOriginalCaseAvailable,
  type DutyRequest, type DutyResponse, type CaseTypesResponse, type CourtType, type PlaintiffType,
  type CaseType, type EconomicCaseType, type EconomicCourtLevel,
} from 'jurist-calculator-shared'
import styles from './Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { FormField, NumericInput, ResultStatus } from './ui'
import { CalculationDetails } from './ui/CalculationDetails'
import { API_ENDPOINTS } from '../config/api'
import { parseNumericInput } from '../utils/numericInput'

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
  const [complaintKind, setComplaintKind] = useState('property')
  const { data: caseTypes, error: caseTypesError, execute: fetchCaseTypes } = useApi<CaseTypesResponse>(API_ENDPOINTS.DUTY_CASE_TYPES, 'GET')
  const inputKey = JSON.stringify({ courtType, caseType, plaintiffType, date, amount, originalCaseType, originalCourtLevel, administrativePenalty, fineAmount, isRepeated, complaintKind })
  const { data, error, loading, stale, execute } = useApi<DutyResponse, DutyRequest>(API_ENDPOINTS.DUTY_CALCULATE, 'POST', { schema: dutyRequestSchema, inputKey })
  useEffect(() => { void fetchCaseTypes() }, [fetchCaseTypes])

  const common = courtType === 'common'
  const available = (common ? caseTypes?.common : caseTypes?.economic) ?? []
  const selection = { courtType, caseType, plaintiffType, originalCaseType, administrativePenalty,
    amount: complaintKind === 'property' ? amount : undefined }
  const required = getDutyRequirements(selection)
  const compatible = available.filter(ct => isDutyCaseAvailable({ ...selection, caseType: ct.id }))
  const originalAvailable = available.filter(ct => isDutyOriginalCaseAvailable(selection, ct.id))
  const originalCourts = getDutyOriginalCourtLevels(originalCaseType)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const basics = { date, ...(required.amount ? { amount: parseNumericInput(amount, true) } : {}) }
    const original = required.originalCaseType && originalCaseType ? originalCaseType : undefined
    const request: DutyRequest = common ? {
      ...basics, courtType: 'common', caseType: caseType as CaseType,
      plaintiffType: plaintiffType as 'individual' | 'organization',
      originalCaseType: original as Exclude<CaseType, 'appeal' | 'cassation' | 'supervision'> | undefined,
      ...(required.isRepeated ? { isRepeated } : {}),
      ...(required.administrativePenalty ? { administrativePenalty, ...(required.fineAmount ? { fineAmount: parseNumericInput(fineAmount, true) } : {}) } : {}),
    } : {
      ...basics, courtType, caseType: caseType as EconomicCaseType, plaintiffType,
      originalCaseType: original as Exclude<EconomicCaseType, 'appeal' | 'cassation' | 'supervision'> | undefined,
      ...(required.showOriginalCourt ? { originalCourtLevel } : {}),
    }
    await execute(request)
  }

  return <div className={styles.calculator}>
    <h2>Калькулятор государственной пошлины</h2>
    <form onSubmit={handleSubmit}>
      <FormField label="Тип суда"><select value={courtType} onChange={e => {
        const court = e.target.value as CourtType
        setCourtType(court); setCaseType('property'); setOriginalCaseType(''); setAmount('')
        if (!getDutyPlaintiffTypes(court).includes(plaintiffType)) setPlaintiffType(getDutyPlaintiffTypes(court)[0])
      }}>{courts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></FormField>
      <FormField label="Тип заявителя"><select value={plaintiffType} onChange={e => {
        setPlaintiffType(e.target.value as PlaintiffType); setCaseType('property'); setOriginalCaseType('')
      }}>{plaintiffs.filter(p => getDutyPlaintiffTypes(courtType).includes(p.value)).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></FormField>
      <FormField label="Дата обращения в суд"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></FormField>
      <FormField label="Тип заявления"><select value={caseType} onChange={e => { setCaseType(e.target.value); setOriginalCaseType(''); setAmount('') }}>
        {compatible.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
      </select></FormField>
      {required.complaint && <FormField label="Характер жалобы"><select value={complaintKind} onChange={e => setComplaintKind(e.target.value)}>
        <option value="property">Имущественная: указать оспариваемую сумму</option>
        <option value="original">По исходному требованию без оспариваемой суммы</option>
      </select></FormField>}
      {required.amount && <FormField label={required.complaint ? 'Оспариваемая сумма (BYN)' : 'Сумма требования (BYN)'}>
        <NumericInput required value={amount} onChange={setAmount} />
      </FormField>}
      {required.originalCaseType && <>
        <FormField label="Исходное требование"><select required value={originalCaseType} onChange={e => {
          setOriginalCaseType(e.target.value)
          const levels = getDutyOriginalCourtLevels(e.target.value)
          if (!levels.includes(originalCourtLevel)) setOriginalCourtLevel(levels[0])
        }}>
          <option value="">Выберите требование</option>
          {originalAvailable.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
        </select></FormField>
        {required.showOriginalCourt && <FormField label="Суд исходного требования"><select required={required.originalCourtLevel} value={originalCourtLevel} onChange={e => setOriginalCourtLevel(e.target.value as EconomicCourtLevel)}>
          {courts.filter(c => originalCourts.includes(c.value as EconomicCourtLevel)).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select></FormField>}
      </>}
      {required.isRepeated && <label><input type="checkbox" checked={isRepeated} onChange={e => setIsRepeated(e.target.checked)} /> Повторный брак</label>}
      {required.administrativePenalty && <>
        <FormField label="Административное взыскание"><select value={administrativePenalty} onChange={e => setAdministrativePenalty(e.target.value as 'fine' | 'other')}>
          <option value="fine">Штраф</option><option value="other">Иное взыскание</option>
        </select></FormField>
        {required.fineAmount && <FormField label="Размер штрафа (BYN)"><NumericInput required value={fineAmount} onChange={setFineAmount} /></FormField>}
      </>}
      <button type="submit" className={styles.btn} disabled={loading || !compatible.some(ct => ct.id === caseType)}>{loading ? 'Расчёт...' : 'Рассчитать'}</button>
    </form>
    {data && <div className={styles.result}>
      <ResultStatus stale={stale} />
      <div className={styles.resultLabel}>Сумма государственной пошлины</div>
      <div className={styles.resultValue}>{data.amount} BYN</div>
      <div className={styles.resultBreakdown}>{data.breakdown}</div>
      <CalculationDetails calculation={data} />
    </div>}
    {(caseTypesError || error) && <div className={styles.error}>{caseTypesError || error}</div>}
  </div>
}
