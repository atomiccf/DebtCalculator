import styles from '../../components/Calculator.module.css'

interface Column {
  key: string
  header: string
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
}

interface TotalRowCell {
  value: React.ReactNode
  colSpan?: number
}

interface ResultsTableProps {
  columns: Column[]
  data: Record<string, unknown>[]
  totalRow?: TotalRowCell[]
}

export function ResultsTable({ columns, data, totalRow }: ResultsTableProps) {
  return (
    <div className={styles.results}>
      <table className={styles.resultsTable}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.key}>
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