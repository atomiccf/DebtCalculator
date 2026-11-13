import type { AnnualDayCount } from 'jurist-calculator-shared'
import { FormField } from './FormField'

const choices: { value: AnnualDayCount; label: string }[] = [
  { value: 'actual/actual', label: 'Календарные дни каждого года (actual/actual)' },
  { value: 'start-year', label: 'Число дней в году начала' },
  { value: 'end-year', label: 'Число дней в году окончания' },
  { value: 360, label: '360' }, { value: 365, label: '365' }, { value: 366, label: '366' },
]
export function DayCountField({ value, onChange, required = false }: {
  value: AnnualDayCount | ''; onChange: (value: AnnualDayCount | '') => void; required?: boolean
}) {
  return <FormField label="Методика годового делителя"><select value={value} required={required}
    onChange={e => onChange(choices.find(c => String(c.value) === e.target.value)?.value ?? '')}>
    <option value="">Выберите методику</option>
    {choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
  </select></FormField>
}
