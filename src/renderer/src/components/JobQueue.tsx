/**
 * JobQueue — panel de cola de procesos.
 *
 * Muestra los trabajos (filtrables por tipo) con estado, barra de progreso,
 * velocidad, ETA y acciones: cancelar, abrir carpeta y limpiar terminados.
 * Se usa embebido en cada pantalla para enseñar solo sus trabajos.
 */
import { Ban, FolderOpen, Loader2, Trash2 } from 'lucide-react'
import type { JobType } from '@shared/types'
import { useJobs } from '../hooks/useJobs'
import { useI18n } from '../hooks/useI18n'
import { formatEta } from '../utils/format'
import { ProgressBar } from './controls'
import { StatusBadge } from './StatusBadge'

interface JobQueueProps {
  /** Si se indica, solo se muestran trabajos de estos tipos */
  types?: JobType[]
}

export function JobQueue({ types }: JobQueueProps): React.JSX.Element {
  const { jobs, cancel, clearFinished } = useJobs()
  const t = useI18n()

  const visible = types ? jobs.filter((j) => types.includes(j.type)) : jobs

  return (
    <section className="queue-panel">
      <header>
        <h2>{t('queue.title')}</h2>
        {visible.some((j) => j.status !== 'pending' && j.status !== 'running') && (
          <button className="btn ghost sm" onClick={() => void clearFinished()}>
            <Trash2 size={14} />
            {t('queue.clearFinished')}
          </button>
        )}
      </header>

      {visible.length === 0 && <div className="empty-state">{t('queue.empty')}</div>}

      {visible.map((job) => (
        <article key={job.id} className="job-card">
          <div className="job-top">
            {job.status === 'running' && <Loader2 size={15} className="spin" style={{ color: 'var(--accent)' }} />}
            <span className="job-title" title={job.title}>
              {job.title}
            </span>
            <StatusBadge status={job.status} />

            {(job.status === 'pending' || job.status === 'running') && (
              <button className="btn ghost sm" onClick={() => void cancel(job.id)} title={t('common.cancel')}>
                <Ban size={14} />
              </button>
            )}
            {job.status === 'completed' && job.outputPath && (
              <button
                className="btn ghost sm"
                onClick={() => void window.api.showItemInFolder(job.outputPath!)}
                title={t('common.openFolder')}
              >
                <FolderOpen size={14} />
              </button>
            )}
          </div>

          {(job.status === 'running' || job.status === 'pending') && (
            <>
              <ProgressBar
                percent={job.progress.percent}
                indeterminate={job.status === 'running' && job.progress.percent === 0}
              />
              <div className="job-meta">
                {job.progress.phase && <span>{job.progress.phase}</span>}
                <span>{job.progress.percent.toFixed(0)}%</span>
                {job.progress.speed && <span>{job.progress.speed}</span>}
                {job.progress.etaSeconds !== undefined && (
                  <span>
                    {formatEta(job.progress.etaSeconds)} {t('queue.eta')}
                  </span>
                )}
              </div>
            </>
          )}

          {job.status === 'error' && job.error && <div className="job-error">{job.error}</div>}
        </article>
      ))}
    </section>
  )
}
