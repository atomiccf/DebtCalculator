import { useState } from 'react'
import styles from './App.module.css'
import DutyCalculator from './components/DutyCalculator'
import PenaltyCalculator from './components/PenaltyCalculator'
import Interest366Calculator from './components/Interest366Calculator'

type Tab = 'duty' | 'penalty' | 'interest366'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('duty')

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Jurist Calculator</h1>
        <p>Калькулятор для судов Республики Беларусь</p>
      </header>
      
      <nav className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'duty' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('duty')}
        >
          Пошлина
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'penalty' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('penalty')}
        >
          Пени
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'interest366' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('interest366')}
        >
          Ст.366 ГК
        </button>
      </nav>
      
      <main className={styles.content}>
        {activeTab === 'duty' && <DutyCalculator />}
        {activeTab === 'penalty' && <PenaltyCalculator />}
        {activeTab === 'interest366' && <Interest366Calculator />}
      </main>
      
      <footer className={styles.footer}>
        <p>Базовая величина: 45 BYN (с 01.01.2026)</p>
        <p>Ставка рефинансирования: 9,75% (с 25.06.2025)</p>
      </footer>
    </div>
  )
}

export default App