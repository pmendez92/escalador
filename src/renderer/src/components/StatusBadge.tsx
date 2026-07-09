/**
 * StatusBadge — indicador de estado con color semántico.
 */
import type { JobStatus } from '@shared/types'
import { useI18n } from '../hooks/useI18n'

export function StatusBadge({ status }: { status: JobStatus }): React.JSX.Element {
  const t = useI18n()
  return <span className={`badge ${status}`}>{t(`status.${status}`)}</span>
}
