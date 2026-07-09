/**
 * VideoUpscalePage — mejora IA de vídeo (Real-ESRGAN + RIFE + FFmpeg).
 */
import { useEffect, useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { AI_VIDEO_MODELS, VIDEO_INPUT_EXTENSIONS, VIDEO_TARGET_RESOLUTIONS } from '@shared/formats'
import type { VideoUpscaleOptions } from '@shared/types'
import { DropZone } from '../components/DropZone'
import { FileList } from '../components/FileList'
import { JobQueue } from '../components/JobQueue'
import { OutputFolderField, Select, Toggle } from '../components/controls'
import { useI18n } from '../hooks/useI18n'
import { useJobs } from '../hooks/useJobs'
import { useSettings } from '../hooks/useSettings'

export function VideoUpscalePage(): React.JSX.Element {
  const t = useI18n()
  const { settings } = useSettings()
  const { enqueue } = useJobs()

  const [files, setFiles] = useState<string[]>([])
  const [resolution, setResolution] = useState<'1080p' | '2k' | '4k'>('1080p')
  const [model, setModel] = useState(AI_VIDEO_MODELS[0].id)
  const [interpolate, setInterpolate] = useState(false)
  const [videoBitrate, setVideoBitrate] = useState('')
  const [outputDir, setOutputDir] = useState('')

  useEffect(() => {
    if (settings && !outputDir) setOutputDir(settings.outputDir)
  }, [settings, outputDir])

  const start = async (): Promise<void> => {
    const options: VideoUpscaleOptions = {
      targetResolution: resolution,
      model,
      interpolate,
      videoBitrate: videoBitrate || undefined
    }
    for (const inputPath of files) {
      await enqueue({ type: 'video-upscale', inputPath, outputDir, options })
    }
    setFiles([])
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('aiVideos.title')}</h1>
        <p>{t('aiVideos.subtitle')}</p>
      </header>

      <DropZone
        extensions={VIDEO_INPUT_EXTENSIONS}
        filterName="Vídeos"
        onFiles={(paths) => setFiles((prev) => [...new Set([...prev, ...paths])])}
      />
      <FileList files={files} onRemove={(p) => setFiles((prev) => prev.filter((f) => f !== p))} />

      <div className="options-bar">
        <Select
          label={t('common.resolution')}
          value={resolution}
          options={VIDEO_TARGET_RESOLUTIONS.map((r) => ({ value: r.id, label: r.label }))}
          onChange={setResolution}
        />
        <Select
          label={t('common.model')}
          value={model}
          options={AI_VIDEO_MODELS.map((m) => ({ value: m.id, label: m.label }))}
          onChange={setModel}
        />
        <div className="field" style={{ width: 140 }}>
          <label>
            {t('common.videoBitrate')} ({t('common.optional')})
          </label>
          <input
            className="input"
            placeholder="p. ej. 8M"
            value={videoBitrate}
            onChange={(e) => setVideoBitrate(e.target.value)}
          />
        </div>
        <OutputFolderField value={outputDir} onChange={setOutputDir} />
        <div className="spacer" />
        <button className="btn primary" disabled={files.length === 0} onClick={() => void start()}>
          <Clapperboard size={15} />
          {t('common.start')} ({files.length})
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: 8 }}>
        <Toggle checked={interpolate} onChange={setInterpolate} label={t('aiVideos.interpolate')} />
      </div>
      <p className="hint">{t('aiVideos.etaNote')}</p>

      <JobQueue types={['video-upscale']} />
    </div>
  )
}
