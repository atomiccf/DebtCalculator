import styles from '../../components/Calculator.module.css'

interface FormFieldProps {
  label: string
  children: React.ReactNode
}

export function FormField({ label, children }: FormFieldProps) {
  return (
    <div className={styles.formGroup}>
      <label>{label}</label>
      {children}
    </div>
  )
}