import { useState } from 'react'
import './Calculator.css'

interface DocumentPenalty {
  name: string
  debt: number
  startDate: string
  endDate: string
}

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

const API_URL = 'http://localhost:3000'

const emptyDocument: DocumentPenalty = {
  name: '',
  debt: 0,
  startDate: '',
  endDate: ''
}

export default function PenaltyCalculator() {
  const [documents, setDocuments] = useState<DocumentPenalty[]>([{ ...emptyDocument }, { ...emptyDocument }])
  const [rate, setRate] = useState('')
  const [result, setResult] = useState<PenaltyResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAddDocument = () => {
    setDocuments([...documents, { ...emptyDocument }])
  }

  const handleRemoveDocument = (index: number) => {
    if (documents.length <= 1) return
    setDocuments(documents.filter((_, i) => i !== index))
  }

  const handleDocumentChange = (index: number, field: keyof DocumentPenalty, value: string | number) => {
    const updated = [...documents]
    updated[index] = { ...updated[index], [field]: value }
    setDocuments(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/penalty/calculate-multiple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents,
          rate: rate ? parseFloat(rate) : undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка расчёта')
      }

      setResult({
        results: data.results,
        total: data.total,
        rate: data.rate
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
      <h2>Калькулятор пени</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="documents-header">
          <span>Документы</span>
          <button type="button" className="btn-add" onClick={handleAddDocument}>
            + Добавить документ
          </button>
        </div>

        <div className="documents-list">
          {documents.map((doc, index) => (
            <div key={index} className="document-row">
              <div className="document-fields">
                <div className="form-group">
                  <input 
                    type="text" 
                    value={doc.name}
                    onChange={(e) => handleDocumentChange(index, 'name', e.target.value)}
                    placeholder="Название (накладная №, договор и т.д.)"
                  />
                </div>
                <div className="form-group">
                  <input 
                    type="number" 
                    value={doc.debt || ''}
                    onChange={(e) => handleDocumentChange(index, 'debt', parseFloat(e.target.value) || 0)}
                    placeholder="Сумма (BYN)"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>с</label>
                  <input 
                    type="date" 
                    value={doc.startDate}
                    onChange={(e) => handleDocumentChange(index, 'startDate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>по</label>
                  <input 
                    type="date" 
                    value={doc.endDate}
                    onChange={(e) => handleDocumentChange(index, 'endDate', e.target.value)}
                  />
                </div>
              </div>
              {documents.length > 1 && (
                <button 
                  type="button" 
                  className="btn-remove"
                  onClick={() => handleRemoveDocument(index)}
                  title="Удалить документ"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="form-group">
          <label>Ставка пени (% в день, по умолчанию 0.1%)</label>
          <input 
            type="number" 
            value={rate} 
            onChange={(e) => setRate(e.target.value)}
            placeholder="0.1"
            min="0"
            step="0.01"
          />
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Расчёт...' : 'Рассчитать'}
        </button>
      </form>

      {result && (
        <div className="results">
          <table className="results-table">
            <thead>
              <tr>
                <th>Документ</th>
                <th>Сумма</th>
                <th>Период</th>
                <th>Дней</th>
                <th>Пени</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.debt} BYN</td>
                  <td>{r.startDate} — {r.endDate}</td>
                  <td>{r.days}</td>
                  <td>{r.penalty} BYN</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={4}>Итого</td>
                <td>{result.total} BYN</td>
              </tr>
            </tfoot>
          </table>
          <div className="results-summary">
            Ставка: {result.rate}% в день
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  )
}