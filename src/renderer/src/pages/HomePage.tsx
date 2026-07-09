/**
 * HomePage — accesos rápidos a cada módulo + actividad reciente.
 */
import { Image, Video, Sparkles, Clapperboard, Download, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HistoryEntry } from '@shared/types'
import { useI18n } from '../hooks/useI18n'
import { useJobs } from '../hooks/useJobs'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate } from '../utils/format'
import type { PageId } from '../App'

const ACTIONS: Array<{ page: PageId; titleKey: string; descKey: string; icon: typeof Image }> = [
  { page: 'images', titleKey: 'nav.images', descKey: 'home.convertImages.desc', icon: Image },
  { page: 'videos', titleKey: 'nav.videos', descKey: 'home.convertVideos.desc', icon: Video },
  { page: 'ai-images', titleKey: 'nav.aiImages', descKey: 'home.aiImages.desc', icon: Sparkles },
  { page: 'ai-videos', titleKey: 'nav.aiVideos', descKey: 'home.aiVideos.desc', icon: Clapperboard },
  { page: 'downloads', titleKey: 'nav.downloads', descKey: 'home.downloads.desc', icon: Download },
  { page: 'settings', titleKey: 'nav.settings', descKey: 'home.settings.desc', icon: Settings }
]

export function HomePage({ onNavigate }: { onNavigate: (p: PageId) => void }): React.JSX.Element {
  const t = useI18n()
  const { jobs } = useJobs()
  const [recent, setRecent] = useState<HistoryEntry[]>([])

  // Refrescar la actividad reciente cuando termina algún trabajo.
  const finishedCount = jobs.filter((j) => j.status === 'completed').length
  useEffect(() => {
    void window.api.listHistory().then((h) => setRecent(h.slice(0, 6)))
  }, [finishedCount])

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('home.title')}</h1>
        <p>{t('home.subtitle')}</p>
      </header>

      <div className="home-hero">
        {ACTIONS.map(({ page, titleKey, descKey, icon: Icon }) => (
          <button key={page} className="home-action" onClick={() => onNavigate(page)}>
            <span className="ha-icon">
              <Icon size={20} />
            </span>
            <h3>{t(titleKey)}</h3>
            <p>{t(descKey)}</p>
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <section className="queue-panel">
          <header>
            <h2>{t('home.recent')}</h2>
          </header>
          {recent.map((entry) => (
            <article key={entry.id} className="job-card">
              <div className="job-top">
                <span className="job-title" title={entry.title}>
                  {entry.title}
                </span>
                <span className="hint">{formatDate(entry.createdAt)}</span>
                <StatusBadge status={entry.status} />
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
