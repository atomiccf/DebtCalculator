import type { CalculationMetadata } from 'jurist-calculator-shared'

export function CalculationDetails({ calculation }: { calculation: CalculationMetadata }) {
  const { methodology, referenceData, warnings } = calculation
  const kinds = { 'court-duty': 'Судебная пошлина', daily: 'Дневная ставка', annual: 'Годовая ставка', 'article-366': 'Статья 366 ГК' }
  return <div>
    <p>Методика: {kinds[methodology.kind]}{methodology.dayCount !== undefined && `; делитель: ${methodology.dayCount}`}.</p>
    <p>Версия правил: {calculation.rulesVersion}</p>
    {referenceData.baseValue && <p>Базовая величина: {referenceData.baseValue.record.value} BYN на {referenceData.baseValue.selectedOn}. {referenceData.baseValue.record.act}</p>}
    {referenceData.refinancingRate && <p>Ставка: {referenceData.refinancingRate.value}% на {referenceData.refinancingRate.selectedOn} ({referenceData.refinancingRate.origin === 'input' ? 'указана пользователем' : 'встроенный справочник'}).</p>}
    {warnings.length > 0 && <ul aria-label="Предупреждения">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
  </div>
}
