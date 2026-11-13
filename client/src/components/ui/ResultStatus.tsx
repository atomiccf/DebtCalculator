import styles from '../Calculator.module.css'

export function ResultStatus({ stale }: { stale: boolean }) {
  return stale ? <p role="status" className={styles.warning}>
    Результат устарел: входные данные изменены. Выполните расчёт заново.
  </p> : null
}
