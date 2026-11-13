import styles from '../../components/Calculator.module.css'

export type ResultsTableColumn<T> = {
  [K in keyof T]-?: {
    key: K
    header: string
    render?: (value: T[K], row: T) => React.ReactNode
  }
}[keyof T]

interface TotalRowCell {
  value: React.ReactNode
  colSpan?: number
}

interface ResultsTableProps<T> {
  columns: ResultsTableColumn<T>[]
  data: T[]
  totalRow?: TotalRowCell[]
}

export function ResultsTable<T>({ columns, data, totalRow }: ResultsTableProps<T>) {
  return (
    <div className={styles.results}>
      <table className={styles.resultsTable}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={String(col.key)}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={String(col.key)}>
                  {col.render 
                    ? col.render(row[col.key], row)
                    : String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totalRow && totalRow.length > 0 && (
          <tfoot>
            <tr className={styles.totalRow}>
              {totalRow.map((cell, i) => (
                <td key={i} colSpan={cell.colSpan}>{cell.value}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
