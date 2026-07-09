/**
 * App — raíz del renderer.
 *
 * Composición de providers (ajustes → i18n → cola) y enrutado simple por
 * estado (una sola ventana, sin necesidad de URLs). Escucha OPEN_WITH_FILES
 * para abrir la pantalla correcta cuando llegan archivos desde el clic
 * derecho del Explorador.
 */
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { SettingsProvider } from './hooks/useSettings'
import { I18nProvider } from './hooks/useI18n'
import { JobsProvider } from './hooks/useJobs'
import { HomePage } from './pages/HomePage'
import { ImageConvertPage } from './pages/ImageConvertPage'
import { VideoConvertPage } from './pages/VideoConvertPage'
import { ImageUpscalePage } from './pages/ImageUpscalePage'
import { VideoUpscalePage } from './pages/VideoUpscalePage'
import { DownloadsPage } from './pages/DownloadsPage'
import { HistoryPage } from './pages/HistoryPage'
import { LogsPage } from './pages/LogsPage'
import { SettingsPage } from './pages/SettingsPage'
import { IMAGE_INPUT_EXTENSIONS } from '@shared/formats'

export type PageId =
  | 'home'
  | 'images'
  | 'videos'
  | 'ai-images'
  | 'ai-videos'
  | 'downloads'
  | 'history'
  | 'logs'
  | 'settings'

/**
 * Archivos entrantes desde el explorador, compartidos con las páginas de
 * conversión mediante prop (evita estado global para un caso puntual).
 */
export interface IncomingFiles {
  images: string[]
  videos: string[]
}

export default function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('home')
  const [incoming, setIncoming] = useState<IncomingFiles>({ images: [], videos: [] })

  // Archivos abiertos con clic derecho → navegar a la pantalla adecuada.
  useEffect(() => {
    return window.api.onOpenWithFiles((files) => {
      const images = files.filter((f) =>
        IMAGE_INPUT_EXTENSIONS.includes(f.split('.').pop()?.toLowerCase() ?? '')
      )
      const videos = files.filter((f) => !images.includes(f))
      setIncoming({ images, videos })
      setPage(images.length >= videos.length ? 'images' : 'videos')
    })
  }, [])

  return (
    <SettingsProvider>
      <I18nProvider>
        <JobsProvider>
          <div className="app-shell">
            <Sidebar current={page} onNavigate={setPage} />
            <main className="app-content">
              {page === 'home' && <HomePage onNavigate={setPage} />}
              {page === 'images' && (
                <ImageConvertPage
                  initialFiles={incoming.images}
                  onConsumeInitial={() => setIncoming((s) => ({ ...s, images: [] }))}
                />
              )}
              {page === 'videos' && (
                <VideoConvertPage
                  initialFiles={incoming.videos}
                  onConsumeInitial={() => setIncoming((s) => ({ ...s, videos: [] }))}
                />
              )}
              {page === 'ai-images' && <ImageUpscalePage />}
              {page === 'ai-videos' && <VideoUpscalePage />}
              {page === 'downloads' && <DownloadsPage />}
              {page === 'history' && <HistoryPage />}
              {page === 'logs' && <LogsPage />}
              {page === 'settings' && <SettingsPage />}
            </main>
          </div>
        </JobsProvider>
      </I18nProvider>
    </SettingsProvider>
  )
}
