/**
 * LogsPage — visor de logs con exportación.
 */
import { useCallback, useEffect, useState } from 'react'
import { FileDown, RefreshCw, Trash2 } from 'lucide-react'
import type { LogEntry } from '@shared/types'
import { useI18n } from '../hooks/useI18n'

export function LogsPage(): React.JSX.Element {
  const t = useI18n()
  const [logs, setLogs] = useState<LogEntry[]>([])

  const refresh = useCallback(async () => {
    setLogs(await window.api.listLogs())
  }, [])

  useEffect(() => {
    void refresh()
    // Refresco periódico ligero mientras la pantalla está abierta.
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [refresh])

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('logs.title')}</h1>
        <p>{t('logs.subtitle')}</p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="btn sm" onClick={() => void refresh()}>
          <RefreshCw size={14} />
        </button>
        <button className="btn sm" onClick={() => void window.api.exportLogs()}>
          <FileDown size={14} />
          {t('common.export')}
        </button>
        <button
          className="btn danger sm"
          onClick={() => {
            void window.api.clearLogs().then(refresh)
          }}
        >
          <Trash2 size={14} />
          {t('common.clear')}
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">{t('logs.empty')}</div>
      ) : (
        <div className="log-view">
          {logs.map((entry, i) => (
            <div key={i} className={`log-line ${entry.level}`}>
              {new Date(entry.timestamp).toLocaleTimeString()} [{entry.level.toUpperCase()}] (
              {entry.scope}) {entry.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
