/**
 * HistoryPage — historial de conversiones, descargas y escalados.
 * Acciones por entrada: abrir carpeta, repetir proceso y eliminar.
 */
import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, RotateCcw, Trash2 } from 'lucide-react'
import type { HistoryEntry } from '@shared/types'
import { StatusBadge } from '../components/StatusBadge'
import { useI18n } from '../hooks/useI18n'
import { useJobs } from '../hooks/useJobs'
import { formatDate, formatDuration } from '../utils/format'

export function HistoryPage(): React.JSX.Element {
  const t = useI18n()
  const { enqueue } = useJobs()
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  const refresh = useCallback(async () => {
    setEntries(await window.api.listHistory())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Repetir proceso: re-encola el trabajo con las mismas opciones. */
  const repeat = async (entry: HistoryEntry): Promise<void> => {
    await enqueue({
      type: entry.jobType,
      inputPath: entry.inputPath,
      outputDir: entry.outputDir,
      options: entry.options
    })
  }

  const remove = async (id: string): Promise<void> => {
    await window.api.removeHistory(id)
    await refresh()
  }

  const clearAll = async (): Promise<void> => {
    await window.api.clearHistory()
    await refresh()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('history.title')}</h1>
        <p>{t('history.subtitle')}</p>
      </header>

      {entries.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button className="btn danger sm" onClick={() => void clearAll()}>
            <Trash2 size={14} />
            {t('history.clearAll')}
          </button>
        </div>
      )}

      {entries.length === 0 && <div className="empty-state">{t('history.empty')}</div>}

      {entries.map((entry) => (
        <article key={entry.id} className="job-card">
          <div className="job-top">
            <span className="job-title" title={entry.title}>
              {entry.title}
            </span>
            <StatusBadge status={entry.status} />
            {entry.outputPath && (
              <button
                className="btn ghost sm"
                title={t('common.openFolder')}
                onClick={() => void window.api.showItemInFolder(entry.outputPath!)}
              >
                <FolderOpen size={14} />
              </button>
            )}
            <button className="btn ghost sm" title={t('common.repeat')} onClick={() => void repeat(entry)}>
              <RotateCcw size={14} />
            </button>
            <button className="btn ghost sm" title={t('common.delete')} onClick={() => void remove(entry.id)}>
              <Trash2 size={14} />
            </button>
          </div>
          <div className="job-meta">
            <span>{formatDate(entry.createdAt)}</span>
            <span>{formatDuration(entry.durationMs)}</span>
          </div>
        </article>
      ))}
    </div>
  )
}
