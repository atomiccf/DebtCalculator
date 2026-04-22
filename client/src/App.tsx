import { useState } from 'react'
import './App.css'
import DutyCalculator from './components/DutyCalculator'
import PenaltyCalculator from './components/PenaltyCalculator'
import Interest366Calculator from './components/Interest366Calculator'

type Tab = 'duty' | 'penalty' | 'interest366'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('duty')

  return (
    <div className="app">
      <header className="header">
        <h1>Jurist Calculator</h1>
        <p>Калькулятор для судов Республики Беларусь</p>
      </header>
      
      <nav className="tabs">
        <button 
          className={`tab ${activeTab === 'duty' ? 'active' : ''}`}
          onClick={() => setActiveTab('duty')}
        >
          Пошлина
        </button>
        <button 
          className={`tab ${activeTab === 'penalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('penalty')}
        >
          Пени
        </button>
        <button 
          className={`tab ${activeTab === 'interest366' ? 'active' : ''}`}
          onClick={() => setActiveTab('interest366')}
        >
          Ст.366 ГК
        </button>
      </nav>
      
      <main className="content">
        {activeTab === 'duty' && <DutyCalculator />}
        {activeTab === 'penalty' && <PenaltyCalculator />}
        {activeTab === 'interest366' && <Interest366Calculator />}
      </main>
      
      <footer className="footer">
        <p>Базовая величина: 45 BYN (с 01.01.2026)</p>
        <p>Ставка рефинансирования: 10% (с 20.03.2025)</p>
      </footer>
    </div>
  )
}

export default App