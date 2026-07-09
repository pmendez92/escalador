/**
 * SettingsPage — configuración de la aplicación.
 *
 * Carpeta por defecto, concurrencia, GPU/CPU, calidad, idioma, tema,
 * actualizaciones, menú contextual de Windows y estado de los motores IA.
 */
import { useEffect, useState } from 'react'
import { Download, FolderOpen, RefreshCw } from 'lucide-react'
import type { BinaryDownloadProgress, BinaryStatus, UpdateInfoPayload } from '@shared/types'
import { ProgressBar, Select, Toggle } from '../components/controls'
import { useI18n } from '../hooks/useI18n'
import { useSettings } from '../hooks/useSettings'
import { formatDate } from '../utils/format'

const BINARY_LABELS: Record<string, string> = {
  realesrgan: 'Real-ESRGAN (imágenes y vídeo)',
  rife: 'RIFE (interpolación de fotogramas)',
  ytdlp: 'yt-dlp (descargas)'
}

export function SettingsPage(): React.JSX.Element {
  const t = useI18n()
  const { settings, update } = useSettings()

  const [binaries, setBinaries] = useState<BinaryStatus[]>([])
  const [binaryProgress, setBinaryProgress] = useState<Record<string, BinaryDownloadProgress>>({})
  const [updateState, setUpdateState] = useState<UpdateInfoPayload | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ supported: boolean; registered: boolean }>({
    supported: false,
    registered: false
  })

  const refreshBinaries = async (): Promise<void> => {
    setBinaries(await window.api.binariesStatus())
  }

  useEffect(() => {
    void refreshBinaries()
    void window.api.contextMenuStatus().then(setCtxMenu)
    const unsubBin = window.api.onBinaryProgress((p) => {
      setBinaryProgress((prev) => ({ ...prev, [p.name]: p }))
      if (p.phase === 'done') void refreshBinaries()
    })
    const unsubUpd = window.api.onUpdateEvent(setUpdateState)
    return () => {
      unsubBin()
      unsubUpd()
    }
  }, [])

  if (!settings) return <div className="page" />

  const pickOutputDir = async (): Promise<void> => {
    const dir = await window.api.selectDirectory()
    if (dir) await update({ outputDir: dir })
  }

  const toggleContextMenu = async (): Promise<void> => {
    if (ctxMenu.registered) await window.api.unregisterContextMenu()
    else await window.api.registerContextMenu()
    setCtxMenu(await window.api.contextMenuStatus())
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.subtitle')}</p>
      </header>

      <div className="card">
        {/* Carpeta por defecto */}
        <div className="settings-row">
          <div className="sr-text">
            <div className="sr-title">{t('settings.outputDir')}</div>
            <div className="sr-sub">{t('settings.outputDirSub')}</div>
          </div>
          <div className="sr-control">
            <input className="input" readOnly value={settings.outputDir} title={settings.outputDir} />
            <button className="btn" onClick={() => void pickOutputDir()}>
              <FolderOpen size={15} />
            </button>
          </div>
        </div>

        {/* Concurrencia */}
        <div className="settings-row">
          <div className="sr-text">
            <div className="sr-title">{t('settings.concurrency')}</div>
            <div className="sr-sub">{t('settings.concurrencySub')}</div>
          </div>
          <div className="sr-control">
            <input
              className="input"
              type="number"
              min={1}
              max={8}
              style={{ width: 90 }}
              value={settings.maxConcurrentJobs}
              onChange={(e) => void update({ maxConcurrentJobs: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* GPU / CPU */}
        <div className="settings-row">
          <div className="sr-text">
            <div className="sr-title">{t('settings.gpu')}</div>
            <div className="sr-sub">{t('settings.gpuSub')}</div>
          </div>
          <div className="sr-control">
            <Toggle checked={settings.useGpu} onChange={(v) => void update({ useGpu: v })} />
          </div>
        </div>

        {/* Calidad por defecto */}
        <div className="settings-row">
          <div className="sr-text">
            <div className="sr-title">{t('settings.quality')}</div>
            <div className="sr-sub">{t('settings.qualitySub')}</div>
          </div>
          <div className="sr-control">
            <Select
              label=""
              value={settings.defaultQuality}
              options={[
                { value: 'low', label: t('settings.quality.low') },
                { value: 'medium', label: t('settings.quality.medium') },
                { value: 'high', label: t('settings.quality.high') }
              ]}
              onChange={(v) => void update({ defaultQuality: v })}
            />
          </div>
        </div>

        {/* Idioma */}
        <div className="settings-row">
          <div className="sr-text">
            <div className="sr-title">{t('settings.language')}</div>
          </div>
          <div className="sr-control">
            <Select
              label=""
              value={settings.language}
              options={[
                { value: 'es', label: 'Español' },
                { value: 'en', label: 'English' }
              ]}
              onChange={(v) => void update({ language: v })}
            />
          </div>
        </div>

        {/* Tema */}
        <div className="settings-row">
          <div className="sr-text">
            <div className="sr-title">{t('settings.theme')}</div>
          </div>
          <div className="sr-control">
            <Select
              label=""
              value={settings.theme}
              options={[
                { value: 'dark', label: t('settings.theme.dark') },
                { value: 'light', label: t('settings.theme.light') },
                { value: 'system', label: t('settings.theme.system') }
              ]}
              onChange={(v) => void update({ theme: v })}
            />
          </div>
        </div>

        {/* Actualizaciones */}
        <div className="settings-row">
          <div className="sr-text">
            <div className="sr-title">{t('settings.updates')}</div>
            <div className="sr-sub">
              {t('settings.updatesSub')}
              {updateState && (
                <>
                  {' · '}
                  {updateState.status === 'checking' && t('settings.updateStatus.checking')}
                  {updateState.status === 'available' &&
                    `${t('settings.updateStatus.available')} (v${updateState.version})`}
                  {updateState.status === 'not-available' && t('settings.updateStatus.notAvailable')}
                  {updateState.status === 'downloading' &&
                    `${t('settings.updateStatus.downloading')} ${updateState.percent ?? 0}%`}
                  {updateState.status === 'downloaded' && t('settings.updateStatus.downloaded')}
                  {updateState.status === 'error' && t('settings.updateStatus.error')}
                </>
              )}
            </div>
          </div>
          <div className="sr-control">
            <Toggle
              checked={settings.checkUpdatesOnStartup}
              onChange={(v) => void update({ checkUpdatesOnStartup: v })}
            />
            {updateState?.status === 'downloaded' ? (
              <button className="btn primary sm" onClick={() => void window.api.installUpdate()}>
                {t('settings.installRestart')}
              </button>
            ) : (
              <button className="btn sm" onClick={() => void window.api.checkUpdates()}>
                {t('settings.checkNow')}
              </button>
            )}
          </div>
        </div>

        {/* Menú contextual de Windows */}
        {ctxMenu.supported && (
          <div className="settings-row">
            <div className="sr-text">
              <div className="sr-title">{t('settings.contextMenu')}</div>
              <div className="sr-sub">{t('settings.contextMenuSub')}</div>
            </div>
            <div className="sr-control">
              <Toggle checked={ctxMenu.registered} onChange={() => void toggleContextMenu()} />
            </div>
          </div>
        )}
      </div>

      {/* Motores IA */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('settings.binaries')}</h3>
        <p className="card-sub">{t('settings.binariesSub')}</p>
        {binaries.map((bin) => {
          const progress = binaryProgress[bin.name]
          const busy = progress && progress.phase !== 'done' && progress.phase !== 'error'
          return (
            <div key={bin.name} className="settings-row">
              <div className="sr-text">
                <div className="sr-title">{BINARY_LABELS[bin.name] ?? bin.name}</div>
                <div className="sr-sub">
                  {bin.installed
                    ? `${t('settings.installed')}${bin.installedAt ? ` · ${formatDate(bin.installedAt)}` : ''}`
                    : t('settings.notInstalled')}
                </div>
                {busy && (
                  <div style={{ marginTop: 8, width: 260 }}>
                    <ProgressBar
                      percent={progress.percent >= 0 ? progress.percent : 50}
                      indeterminate={progress.percent < 0 || progress.phase !== 'downloading'}
                    />
                  </div>
                )}
              </div>
              <div className="sr-control">
                {bin.installed ? (
                  <button
                    className="btn sm"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      void window.api.updateBinary(bin.name).then(refreshBinaries)
                    }}
                  >
                    <RefreshCw size={14} />
                    {t('settings.update')}
                  </button>
                ) : (
                  <button
                    className="btn primary sm"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      void window.api.ensureBinary(bin.name).then(refreshBinaries)
                    }}
                  >
                    <Download size={14} />
                    {t('settings.install')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
