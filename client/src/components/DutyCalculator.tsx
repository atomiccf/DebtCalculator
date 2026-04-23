import { useState, useEffect } from 'react'
import styles from '../components/Calculator.module.css'
import { useApi } from '../hooks/useApi'
import { FormField } from '../components/ui'
import { API_ENDPOINTS } from '../config/api'

interface DutyResult {
  amount: number
  baseValue: number
  breakdown: string
}

interface CaseType {
  id: string
  name: string
}

const courtTypes = [
  { value: 'common', label: 'Суд общей юрисдикции' },
  { value: 'economic', label: 'Экономический суд' },
  { value: 'supreme_economic', label: 'Судебная коллегия по экономическим делам ВС РБ' },
]

const plaintiffTypes = [
  { value: 'individual', label: 'Физическое лицо' },
  { value: 'organization', label: 'Юридическое лицо' },
]

interface CaseTypesResponse {
  common: CaseType[]
  economic: CaseType[]
}

export default function DutyCalculator() {
  const [courtType, setCourtType] = useState('common')
  const [caseType, setCaseType] = useState('property')
  const [plaintiffType, setPlaintiffType] = useState('individual')
  const [amount, setAmount] = useState('')
  
  const [commonCaseTypes, setCommonCaseTypes] = useState<CaseType[]>([])
  const [economicCaseTypes, setEconomicCaseTypes] = useState<CaseType[]>([])

  const { data: caseTypesData, error: caseTypesError, execute: fetchCaseTypes } = useApi<CaseTypesResponse>(API_ENDPOINTS.DUTY_CASE_TYPES, 'GET')
  const { data: dutyData, error, loading, execute } = useApi<DutyResult>(API_ENDPOINTS.DUTY_CALCULATE)

  useEffect(() => {
    fetchCaseTypes()
  }, [fetchCaseTypes])

  useEffect(() => {
    if (caseTypesData) {
      setCommonCaseTypes(caseTypesData.common || [])
      setEconomicCaseTypes(caseTypesData.economic || [])
    }
  }, [caseTypesData])

  const caseTypes = courtType === 'common' ? commonCaseTypes : economicCaseTypes
  const displayError = caseTypesError || error

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await execute({
      courtType,
      caseType,
      plaintiffType,
      amount: amount ? parseFloat(amount) : undefined
    })
  }

  return (
    <div className={styles.calculator}>
      <h2>Калькулятор государственной пошлины</h2>
      
      <form onSubmit={handleSubmit}>
        <FormField label="Тип суда">
          <select value={courtType} onChange={(e) => { setCourtType(e.target.value); setCaseType('property') }}>
            {courtTypes.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
          </select>
        </FormField>

        <FormField label="Тип заявления">
          <select value={caseType} onChange={(e) => setCaseType(e.target.value)}>
            {caseTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
          </select>
        </FormField>

        <FormField label="Тип заявителя">
          <select value={plaintiffType} onChange={(e) => setPlaintiffType(e.target.value)}>
            {plaintiffTypes.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
          </select>
        </FormField>

        {['property', 'court_order'].includes(caseType) && (
          <FormField label="Сумма иска (BYN)">
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Введите сумму"
              min="0"
              step="0.01"
            />
          </FormField>
        )}

        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? 'Расчёт...' : 'Рассчитать'}
        </button>
      </form>

      {dutyData && (
        <div className={styles.result}>
          <div className={styles.resultLabel}>Сумма государственной пошлины</div>
          <div className={styles.resultValue}>{dutyData.amount} BYN</div>
          <div className={styles.resultBreakdown}>{dutyData.breakdown}</div>
        </div>
      )}

      {displayError && <div className={styles.error}>{displayError}</div>}
    </div>
  )
}