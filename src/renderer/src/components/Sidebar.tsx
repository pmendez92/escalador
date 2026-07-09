/**
 * Sidebar — navegación lateral principal.
 */
import {
  Home,
  Image,
  Video,
  Sparkles,
  Clapperboard,
  Download,
  History,
  ScrollText,
  Settings,
  ArrowUpRight
} from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import type { PageId } from '../App'

interface SidebarProps {
  current: PageId
  onNavigate: (page: PageId) => void
}

const NAV_ITEMS: Array<{ id: PageId; labelKey: string; icon: typeof Home }> = [
  { id: 'home', labelKey: 'nav.home', icon: Home },
  { id: 'images', labelKey: 'nav.images', icon: Image },
  { id: 'videos', labelKey: 'nav.videos', icon: Video },
  { id: 'ai-images', labelKey: 'nav.aiImages', icon: Sparkles },
  { id: 'ai-videos', labelKey: 'nav.aiVideos', icon: Clapperboard },
  { id: 'downloads', labelKey: 'nav.downloads', icon: Download },
  { id: 'history', labelKey: 'nav.history', icon: History },
  { id: 'logs', labelKey: 'nav.logs', icon: ScrollText },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings }
]

export function Sidebar({ current, onNavigate }: SidebarProps): React.JSX.Element {
  const t = useI18n()
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="logo">
          <ArrowUpRight size={18} />
        </span>
        Escalador
      </div>

      {NAV_ITEMS.map(({ id, labelKey, icon: Icon }) => (
        <button
          key={id}
          className={`nav-item ${current === id ? 'active' : ''}`}
          onClick={() => onNavigate(id)}
        >
          <Icon size={17} />
          {t(labelKey)}
        </button>
      ))}

      <div className="sidebar-footer">Escalador v1.0.0</div>
    </aside>
  )
}
