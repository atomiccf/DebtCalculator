import { useState, useEffect } from 'react'
import './App.css'
import DutyCalculator from './components/DutyCalculator'
import PenaltyCalculator from './components/PenaltyCalculator'

type Tab = 'duty' | 'penalty'

interface CurrentRates {
  baseValue: number
  baseValueDate: string
  baseValueAct: string
  refinancingRate: number
  refinancingRateDate: string
  updatedAt: string
  fallback?: boolean
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('duty')
  const [rates, setRates] = useState<CurrentRates | null>(null)

  useEffect(() => {
    fetch('/api/rates/current')
      .then(res => res.json())
      .then(data => setRates(data))
      .catch(() => {
        setRates({
          baseValue: 45,
          baseValueDate: '2026-01-01',
          baseValueAct: 'fallback',
          refinancingRate: 9.75,
          refinancingRateDate: 'fallback',
          updatedAt: new Date().toISOString(),
          fallback: true
        })
      })
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>Jurist Calculator</h1>
        <p>Калькулятор государственной пошлины и пени для судов РБ</p>
      </header>
      
      <nav className="tabs">
        <button 
          className={`tab ${activeTab === 'duty' ? 'active' : ''}`}
          onClick={() => setActiveTab('duty')}
        >
          Государственная пошлина
        </button>
        <button 
          className={`tab ${activeTab === 'penalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('penalty')}
        >
          Калькулятор пени
        </button>
      </nav>
      
      <main className="content">
        {activeTab === 'duty' && <DutyCalculator />}
        {activeTab === 'penalty' && <PenaltyCalculator />}
      </main>
      
      <footer className="footer">
        {rates ? (
          <>
            <p>Базовая величина: {rates.baseValue} BYN (с {rates.baseValueDate})</p>
            <p>Ставка рефинансирования: {rates.refinancingRate}% (с {rates.refinancingRateDate}){rates.fallback && ' *'}</p>
          </>
        ) : (
          <p>Загрузка...</p>
        )}
      </footer>
    </div>
  )
}

export default App