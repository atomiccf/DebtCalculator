import styles from '../../components/Calculator.module.css'

interface DocumentFormProps {
  document: Record<string, string | number>
  index: number
  onChange: (index: number, field: string, value: string | number) => void
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
            value={document.name as string}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            placeholder="Название (накладная №, договор и т.д.)"
          />
        </div>
        <div className={styles.formGroup}>
          <input 
            type="number" 
            value={document.debt as number || ''}
            onChange={(e) => onChange(index, 'debt', parseFloat(e.target.value) || 0)}
            placeholder="Сумма (BYN)"
            min="0"
            step="0.01"
          />
        </div>
        <div className={styles.formGroup}>
          <label>с</label>
          <input 
            type="date" 
            value={document.startDate as string}
            onChange={(e) => onChange(index, 'startDate', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>по</label>
          <input 
            type="date" 
            value={document.endDate as string}
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