/**
 * VideoConvertPage — conversor de vídeo y extractor de audio por lotes.
 *
 * Dos pestañas: Vídeo (contenedores) y Audio (MP3/WAV/OGG). El bitrate es
 * configurable; vacío significa calidad constante (CRF), la mejor opción
 * para conservar detalle.
 */
import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { AUDIO_TARGET_FORMATS, VIDEO_INPUT_EXTENSIONS, VIDEO_TARGET_FORMATS } from '@shared/formats'
import type { VideoConvertOptions, VideoTargetFormat } from '@shared/types'
import { DropZone } from '../components/DropZone'
import { FileList } from '../components/FileList'
import { JobQueue } from '../components/JobQueue'
import { OutputFolderField, Select, Toggle } from '../components/controls'
import { useI18n } from '../hooks/useI18n'
import { useJobs } from '../hooks/useJobs'
import { useSettings } from '../hooks/useSettings'

interface Props {
  initialFiles: string[]
  onConsumeInitial: () => void
}

export function VideoConvertPage({ initialFiles, onConsumeInitial }: Props): React.JSX.Element {
  const t = useI18n()
  const { settings } = useSettings()
  const { enqueue } = useJobs()

  const [tab, setTab] = useState<'video' | 'audio'>('video')
  const [files, setFiles] = useState<string[]>([])
  const [videoFormat, setVideoFormat] = useState<VideoTargetFormat>('mp4')
  const [audioFormat, setAudioFormat] = useState<VideoTargetFormat>('mp3')
  const [videoBitrate, setVideoBitrate] = useState('')
  const [audioBitrate, setAudioBitrate] = useState('192k')
  const [outputDir, setOutputDir] = useState('')
  const [keepSubtitles, setKeepSubtitles] = useState(true)
  const [stripMetadata, setStripMetadata] = useState(false)
  const [compress, setCompress] = useState(false)

  useEffect(() => {
    if (settings && !outputDir) setOutputDir(settings.outputDir)
  }, [settings, outputDir])

  useEffect(() => {
    if (initialFiles.length > 0) {
      setFiles((prev) => [...new Set([...prev, ...initialFiles])])
      onConsumeInitial()
    }
  }, [initialFiles, onConsumeInitial])

  const convert = async (): Promise<void> => {
    const options: VideoConvertOptions = {
      targetFormat: tab === 'video' ? videoFormat : audioFormat,
      videoBitrate: videoBitrate || undefined,
      audioBitrate: audioBitrate || undefined,
      keepSubtitles,
      stripMetadata,
      compress
    }
    for (const inputPath of files) {
      await enqueue({ type: 'video-convert', inputPath, outputDir, options })
    }
    setFiles([])
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('videos.title')}</h1>
        <p>{t('videos.subtitle')}</p>
      </header>

      <DropZone
        extensions={VIDEO_INPUT_EXTENSIONS}
        filterName="Vídeos"
        onFiles={(paths) => setFiles((prev) => [...new Set([...prev, ...paths])])}
      />
      <FileList files={files} onRemove={(p) => setFiles((prev) => prev.filter((f) => f !== p))} />

      {/* Pestañas Vídeo / Audio */}
      <div className="chip-row" style={{ margin: '16px 0 0' }}>
        <button className={`btn sm ${tab === 'video' ? 'primary' : ''}`} onClick={() => setTab('video')}>
          {t('videos.tabVideo')}
        </button>
        <button className={`btn sm ${tab === 'audio' ? 'primary' : ''}`} onClick={() => setTab('audio')}>
          {t('videos.tabAudio')}
        </button>
      </div>

      <div className="options-bar">
        {tab === 'video' ? (
          <>
            <Select
              label={t('common.format')}
              value={videoFormat}
              options={VIDEO_TARGET_FORMATS.map((f) => ({ value: f.id, label: f.label }))}
              onChange={setVideoFormat}
            />
            <div className="field" style={{ width: 140 }}>
              <label>
                {t('common.videoBitrate')} ({t('common.optional')})
              </label>
              <input
                className="input"
                placeholder="p. ej. 4M"
                value={videoBitrate}
                onChange={(e) => setVideoBitrate(e.target.value)}
              />
            </div>
          </>
        ) : (
          <Select
            label={t('common.format')}
            value={audioFormat}
            options={AUDIO_TARGET_FORMATS.map((f) => ({ value: f.id, label: f.label }))}
            onChange={setAudioFormat}
          />
        )}
        <div className="field" style={{ width: 130 }}>
          <label>{t('common.audioBitrate')}</label>
          <input
            className="input"
            placeholder="192k"
            value={audioBitrate}
            onChange={(e) => setAudioBitrate(e.target.value)}
          />
        </div>
        <OutputFolderField value={outputDir} onChange={setOutputDir} />
        <div className="spacer" />
        <button className="btn primary" disabled={files.length === 0} onClick={() => void convert()}>
          <Play size={15} />
          {tab === 'video' ? t('common.convert') : t('videos.extractAudio')} ({files.length})
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: 8 }}>
        {tab === 'video' && (
          <Toggle checked={keepSubtitles} onChange={setKeepSubtitles} label={t('videos.keepSubtitles')} />
        )}
        <Toggle checked={stripMetadata} onChange={setStripMetadata} label={t('videos.stripMetadata')} />
        <Toggle checked={compress} onChange={setCompress} label={t('videos.compress')} />
      </div>

      <JobQueue types={['video-convert']} />
    </div>
  )
}
