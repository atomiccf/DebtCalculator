import styles from '../../components/Calculator.module.css'
import type { Document } from '../../hooks/useDocuments'
import { NumericInput } from './NumericInput'

interface DocumentFormProps {
  document: Document
  index: number
  onChange: (index: number, field: keyof Document, value: string) => void
  onRemove?: (index: number) => void
  canRemove: boolean
}

export function DocumentForm({ document, index, onChange, onRemove, canRemove }: DocumentFormProps) {
  return (
    <div className={styles.documentRow}>
      <div className={styles.documentFields}>
        <div className={styles.formGroup}>
          <input 
            type="text" 
            required
            aria-label={`Документ ${index + 1}: название`}
            value={document.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            placeholder="Название (накладная №, договор и т.д.)"
          />
        </div>
        <div className={styles.formGroup}>
          <NumericInput
            required
            label={`Документ ${index + 1}: сумма (BYN)`}
            value={document.debt}
            onChange={value => onChange(index, 'debt', value)}
            placeholder="Сумма (BYN)"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Первый день просрочки</label>
          <input 
            type="date" 
            required
            aria-label={`Документ ${index + 1}: первый день просрочки`}
            value={document.startDate}
            onChange={(e) => onChange(index, 'startDate', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>по</label>
          <input 
            type="date" 
            required
            aria-label={`Документ ${index + 1}: последний день просрочки`}
            min={document.startDate}
            value={document.endDate}
            onChange={(e) => onChange(index, 'endDate', e.target.value)}
          />
        </div>
      </div>
      {canRemove && onRemove && (
        <button 
          type="button" 
          className={styles.btnRemove}
          onClick={() => onRemove(index)}
          title="Удалить документ"
        >
          ×
        </button>
      )}
    </div>
  )
}
