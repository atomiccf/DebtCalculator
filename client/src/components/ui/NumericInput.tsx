interface NumericInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  label?: string
  placeholder?: string
}

export function NumericInput({ value, onChange, required, label, placeholder }: NumericInputProps) {
  return <input type="text" inputMode="decimal" required={required}
    aria-label={label} placeholder={placeholder} value={value}
    onChange={e => onChange(e.target.value)} />
}
