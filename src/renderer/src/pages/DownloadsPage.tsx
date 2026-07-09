/**
 * DownloadsPage — descargas de vídeo y audio con yt-dlp.
 *
 * Modo vídeo: resolución, contenedor, miniatura, subtítulos y playlists.
 * Modo audio: MP3/WAV/OGG con bitrate, nombre personalizado y portada.
 */
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { SUPPORTED_SITES } from '@shared/formats'
import type { DownloadOptions } from '@shared/types'
import { JobQueue } from '../components/JobQueue'
import { OutputFolderField, Select, Toggle } from '../components/controls'
import { useI18n } from '../hooks/useI18n'
import { useJobs } from '../hooks/useJobs'
import { useSettings } from '../hooks/useSettings'

export function DownloadsPage(): React.JSX.Element {
  const t = useI18n()
  const { settings } = useSettings()
  const { enqueue } = useJobs()

  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<'video' | 'audio'>('video')
  const [resolution, setResolution] = useState('best')
  const [format, setFormat] = useState('mp4')
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'wav' | 'ogg'>('mp3')
  const [audioBitrate, setAudioBitrate] = useState('192')
  const [filename, setFilename] = useState('')
  const [thumbnail, setThumbnail] = useState(false)
  const [subtitles, setSubtitles] = useState(false)
  const [playlist, setPlaylist] = useState(false)
  const [embedThumbnail, setEmbedThumbnail] = useState(true)
  const [outputDir, setOutputDir] = useState('')

  useEffect(() => {
    if (settings && !outputDir) setOutputDir(settings.outputDir)
  }, [settings, outputDir])

  const validUrl = /^https?:\/\/\S+\.\S+/.test(url)

  const start = async (): Promise<void> => {
    const options: DownloadOptions = {
      url: url.trim(),
      mode,
      resolution,
      format,
      downloadThumbnail: thumbnail,
      downloadSubtitles: subtitles,
      playlist,
      audioFormat,
      audioBitrate,
      embedThumbnail,
      filename: filename || undefined
    }
    await enqueue({ type: 'download', outputDir, options })
    setUrl('')
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('downloads.title')}</h1>
        <p>{t('downloads.subtitle')}</p>
      </header>

      <div className="card">
        <div className="field">
          <label>{t('downloads.url')}</label>
          <input
            className="input"
            placeholder={t('downloads.urlPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="options-bar">
          <Select
            label={t('downloads.mode')}
            value={mode}
            options={[
              { value: 'video', label: t('downloads.modeVideo') },
              { value: 'audio', label: t('downloads.modeAudio') }
            ]}
            onChange={setMode}
          />

          {mode === 'video' ? (
            <>
              <Select
                label={t('common.resolution')}
                value={resolution}
                options={[
                  { value: 'best', label: t('downloads.best') },
                  { value: '2160', label: '4K (2160p)' },
                  { value: '1440', label: '2K (1440p)' },
                  { value: '1080', label: '1080p' },
                  { value: '720', label: '720p' },
                  { value: '480', label: '480p' }
                ]}
                onChange={setResolution}
              />
              <Select
                label={t('common.format')}
                value={format}
                options={[
                  { value: 'mp4', label: 'MP4' },
                  { value: 'mkv', label: 'MKV' },
                  { value: 'webm', label: 'WEBM' }
                ]}
                onChange={setFormat}
              />
            </>
          ) : (
            <>
              <Select
                label={t('common.format')}
                value={audioFormat}
                options={[
                  { value: 'mp3', label: 'MP3' },
                  { value: 'wav', label: 'WAV' },
                  { value: 'ogg', label: 'OGG' }
                ]}
                onChange={setAudioFormat}
              />
              <Select
                label={t('common.audioBitrate')}
                value={audioBitrate}
                options={[
                  { value: '320', label: '320 kbps' },
                  { value: '256', label: '256 kbps' },
                  { value: '192', label: '192 kbps' },
                  { value: '128', label: '128 kbps' }
                ]}
                onChange={setAudioBitrate}
              />
            </>
          )}

          <div className="field" style={{ minWidth: 180 }}>
            <label>
              {t('downloads.filename')} ({t('common.optional')})
            </label>
            <input
              className="input"
              placeholder={t('downloads.filenamePlaceholder')}
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>

          <OutputFolderField value={outputDir} onChange={setOutputDir} />
          <div className="spacer" />
          <button className="btn primary" disabled={!validUrl} onClick={() => void start()}>
            <Download size={15} />
            {t('downloads.download')}
          </button>
        </div>

        <div className="chip-row">
          <Toggle checked={thumbnail} onChange={setThumbnail} label={t('downloads.thumbnail')} />
          <Toggle checked={subtitles} onChange={setSubtitles} label={t('downloads.subtitles')} />
          <Toggle checked={playlist} onChange={setPlaylist} label={t('downloads.playlist')} />
          {mode === 'audio' && (
            <Toggle
              checked={embedThumbnail}
              onChange={setEmbedThumbnail}
              label={t('downloads.embedThumbnail')}
            />
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <p className="hint" style={{ marginBottom: 8 }}>
          {t('downloads.supported')}:
        </p>
        <div className="chip-row">
          {SUPPORTED_SITES.map((site) => (
            <span key={site} className="chip">
              {site}
            </span>
          ))}
        </div>
      </div>

      <JobQueue types={['download']} />
    </div>
  )
}
