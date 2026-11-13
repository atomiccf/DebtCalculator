import type { CalculationMetadata } from 'jurist-calculator-shared'

function Source({ value }: { value: string }) {
  return /^https?:\/\//.test(value) ? <a href={value} target="_blank" rel="noreferrer">Источник</a> : <span>{value}</span>
}

export function CalculationDetails({ calculation }: { calculation: CalculationMetadata }) {
  const { methodology, referenceData, rules, warnings } = calculation
  const kinds = { 'court-duty': 'Судебная пошлина', daily: 'Пеня', annual: 'Годовая ставка', 'article-366': 'Статья 366 ГК' }
  return <div>
    <p>Методика: {kinds[methodology.kind]}{methodology.dayCount !== undefined && `; делитель: ${methodology.dayCount}`}.</p>
    <p>Версия правил: {calculation.rulesVersion}. <Source value={rules.source} />. {rules.provisions}
      {rules.dateFrom && ` Действует с ${rules.dateFrom}`}{rules.dateTo && ` по ${rules.dateTo}`}.
      {rules.verifiedOn && ` Проверено ${rules.verifiedOn}.`}</p>
    {referenceData.baseValue && <p>Базовая величина: {referenceData.baseValue.record.value} BYN на {referenceData.baseValue.selectedOn}.
      {' '}Действует с {referenceData.baseValue.record.dateFrom}{referenceData.baseValue.record.dateTo ? ` по ${referenceData.baseValue.record.dateTo}` : '; дата окончания не установлена'}.
      {' '}{referenceData.baseValue.record.act}. <Source value={referenceData.baseValue.record.source} />.
      {' '}Версия справочника: {referenceData.baseValue.record.version}.
      {referenceData.baseValue.record.supportedThrough && ` Поддержано по ${referenceData.baseValue.record.supportedThrough}.`}</p>}
    {referenceData.refinancingRate && <p>Ставка: {referenceData.refinancingRate.value}% на {referenceData.refinancingRate.selectedOn}
      {' '}({referenceData.refinancingRate.origin === 'input' ? 'указана пользователем' : 'встроенный справочник'}).
      {referenceData.refinancingRate.dateFrom ? ` Действует с ${referenceData.refinancingRate.dateFrom}` : ' Дата начала действия пользователем не предоставлена'}
      {referenceData.refinancingRate.dateTo ? ` по ${referenceData.refinancingRate.dateTo}.` : '; дата окончания не установлена.'}
      {' '}<Source value={referenceData.refinancingRate.source} />. Версия справочника: {referenceData.refinancingRate.version}.
      {referenceData.refinancingRate.record && <> {referenceData.refinancingRate.record.act}.
        {referenceData.refinancingRate.record.verifiedOn && ` Проверено ${referenceData.refinancingRate.record.verifiedOn}.`}
        {referenceData.refinancingRate.record.supportedThrough && ` Поддержано по ${referenceData.refinancingRate.record.supportedThrough}.`}</>}</p>}
    {referenceData.dailyRate && <p>Размер пени: {referenceData.dailyRate.value}% в день. Источник: указан пользователем.
      {' '}Применена за период {referenceData.dailyRate.dateFrom} — {referenceData.dailyRate.dateTo}; срок действия договора отдельно не проверен.</p>}
    {warnings.length > 0 && <ul aria-label="Предупреждения" role="status">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
  </div>
}
