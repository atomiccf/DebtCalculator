import { useState, useEffect } from 'react'
import './Calculator.css'

interface DutyResult {
  amount: number
  baseValue: number
  breakdown: string
}

interface CaseType {
  id: string
  name: string
}

interface CaseTypesResponse {
  common: CaseType[]
  economic: CaseType[]
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

const API_URL = 'http://localhost:3000'

export default function DutyCalculator() {
  const [courtType, setCourtType] = useState('common')
  const [caseType, setCaseType] = useState('property')
  const [plaintiffType, setPlaintiffType] = useState('individual')
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<DutyResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [commonCaseTypes, setCommonCaseTypes] = useState<CaseType[]>([])
  const [economicCaseTypes, setEconomicCaseTypes] = useState<CaseType[]>([])

  useEffect(() => {
    fetch(`${API_URL}/api/duty/case-types`)
      .then(res => res.json())
      .then((data: CaseTypesResponse) => {
        setCommonCaseTypes(data.common || [])
        setEconomicCaseTypes(data.economic || [])
      })
      .catch(() => {
        setError('Не удалось загрузить типы дел. Убедитесь, что сервер запущен.')
      })
  }, [])

  const caseTypes = courtType === 'common' ? commonCaseTypes : economicCaseTypes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/duty/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtType,
          caseType,
          plaintiffType,
          amount: amount ? parseFloat(amount) : undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка расчёта')
      }

      setResult({
        amount: data.amount,
        baseValue: data.baseValue,
        breakdown: data.breakdown
      })
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Ошибка соединения с сервером. Убедитесь, что сервер запущен на порту 3000.')
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка расчёта')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="calculator">
      <h2>Калькулятор государственной пошлины</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Тип суда</label>
          <select value={courtType} onChange={(e) => { setCourtType(e.target.value); setCaseType('property') }}>
            {courtTypes.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Тип заявления</label>
          <select value={caseType} onChange={(e) => setCaseType(e.target.value)}>
            {caseTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Тип заявителя</label>
          <select value={plaintiffType} onChange={(e) => setPlaintiffType(e.target.value)}>
            {plaintiffTypes.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
          </select>
        </div>

        {['property', 'court_order'].includes(caseType) && (
          <div className="form-group">
            <label>Сумма иска (BYN)</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Введите сумму"
              min="0"
              step="0.01"
            />
          </div>
        )}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Расчёт...' : 'Рассчитать'}
        </button>
      </form>

      {result && (
        <div className="result">
          <div className="result-label">Сумма государственной пошлины</div>
          <div className="result-value">{result.amount} BYN</div>
          <div className="result-breakdown">{result.breakdown}</div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  )
}