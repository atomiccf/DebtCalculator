import { useState } from 'react'
import './App.css'
import DutyCalculator from './components/DutyCalculator'
import PenaltyCalculator from './components/PenaltyCalculator'

type Tab = 'duty' | 'penalty'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('duty')

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
        <p>Базовая величина: 45 BYN (с 01.01.2026)</p>
        <p>Ставка пени: 0.1% в день</p>
      </footer>
    </div>
  )
}

export default App