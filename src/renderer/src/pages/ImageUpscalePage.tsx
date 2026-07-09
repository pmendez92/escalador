/**
 * ImageUpscalePage — escalado IA de imágenes (Real-ESRGAN).
 *
 * Además de encolar los trabajos, escucha su finalización para alimentar el
 * comparador antes/después (extra "vista previa + comparador deslizante").
 * La descarga automática del binario/modelos se muestra con su progreso.
 */
import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AI_IMAGE_MODELS, IMAGE_INPUT_EXTENSIONS } from '@shared/formats'
import type { BinaryDownloadProgress, ImageUpscaleOptions } from '@shared/types'
import { DropZone } from '../components/DropZone'
import { FileList } from '../components/FileList'
import { JobQueue } from '../components/JobQueue'
import { BeforeAfterSlider } from '../components/BeforeAfterSlider'
import { OutputFolderField, ProgressBar, Select } from '../components/controls'
import { useI18n } from '../hooks/useI18n'
import { useJobs } from '../hooks/useJobs'
import { useSettings } from '../hooks/useSettings'

export function ImageUpscalePage(): React.JSX.Element {
  const t = useI18n()
  const { settings } = useSettings()
  const { jobs, enqueue } = useJobs()

  const [files, setFiles] = useState<string[]>([])
  const [scale, setScale] = useState<'2' | '4' | '8'>('4')
  const [model, setModel] = useState(AI_IMAGE_MODELS[0].id)
  // 25 % de textura original por defecto: piel realista sin sacrificar nitidez.
  const [texture, setTexture] = useState(25)
  const [outputDir, setOutputDir] = useState('')
  const [binaryProgress, setBinaryProgress] = useState<BinaryDownloadProgress | null>(null)
  const [compare, setCompare] = useState<{ before: string; after: string } | null>(null)

  useEffect(() => {
    if (settings && !outputDir) setOutputDir(settings.outputDir)
  }, [settings, outputDir])

  // Progreso de la descarga automática de Real-ESRGAN.
  useEffect(() => {
    return window.api.onBinaryProgress((p) => {
      if (p.name !== 'realesrgan') return
      setBinaryProgress(p.phase === 'done' ? null : p)
    })
  }, [])

  // Al completarse el último escalado, cargar el comparador antes/después.
  const lastCompleted = useMemo(
    () =>
      jobs.find(
        (j) => j.type === 'image-upscale' && j.status === 'completed' && j.inputPath && j.outputPath
      ),
    [jobs]
  )
  useEffect(() => {
    if (!lastCompleted?.inputPath || !lastCompleted.outputPath) return
    void (async () => {
      const [before, after] = await Promise.all([
        window.api.fileToDataUrl(lastCompleted.inputPath!),
        window.api.fileToDataUrl(lastCompleted.outputPath!)
      ])
      if (before && after) setCompare({ before, after })
    })()
  }, [lastCompleted])

  const start = async (): Promise<void> => {
    const options: ImageUpscaleOptions = { scale: Number(scale) as 2 | 4 | 8, model, texture }
    for (const inputPath of files) {
      await enqueue({ type: 'image-upscale', inputPath, outputDir, options })
    }
    setFiles([])
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('aiImages.title')}</h1>
        <p>{t('aiImages.subtitle')}</p>
      </header>

      <DropZone
        extensions={IMAGE_INPUT_EXTENSIONS}
        filterName="Imágenes"
        onFiles={(paths) => setFiles((prev) => [...new Set([...prev, ...paths])])}
      />
      <FileList files={files} onRemove={(p) => setFiles((prev) => prev.filter((f) => f !== p))} />

      <div className="options-bar">
        <Select
          label={t('common.scale')}
          value={scale}
          options={[
            { value: '2', label: '2×' },
            { value: '4', label: '4×' },
            { value: '8', label: '8×' }
          ]}
          onChange={setScale}
        />
        <Select
          label={t('common.model')}
          value={model}
          options={AI_IMAGE_MODELS.map((m) => ({ value: m.id, label: m.label }))}
          onChange={setModel}
        />
        <div className="field" style={{ width: 170 }} title={t('aiImages.textureHint')}>
          <label>
            {t('aiImages.texture')} ({texture}%)
          </label>
          <input
            className="input"
            type="range"
            min={0}
            max={50}
            step={5}
            value={texture}
            onChange={(e) => setTexture(Number(e.target.value))}
          />
        </div>
        <OutputFolderField value={outputDir} onChange={setOutputDir} />
        <div className="spacer" />
        <button className="btn primary" disabled={files.length === 0} onClick={() => void start()}>
          <Sparkles size={15} />
          {t('common.start')} ({files.length})
        </button>
      </div>

      <p className="hint">{t('aiImages.dpiNote')}</p>

      {/* Descarga automática del motor IA con progreso */}
      {binaryProgress && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Real-ESRGAN</h3>
          <p className="card-sub" style={{ marginBottom: 10 }}>
            {binaryProgress.phase === 'downloading' &&
              `Descargando modelo… ${binaryProgress.percent >= 0 ? `${binaryProgress.percent}%` : ''}`}
            {binaryProgress.phase === 'extracting' && 'Extrayendo…'}
            {binaryProgress.phase === 'verifying' && 'Verificando integridad…'}
            {binaryProgress.phase === 'error' && `Error: ${binaryProgress.error}`}
          </p>
          <ProgressBar
            percent={binaryProgress.percent >= 0 ? binaryProgress.percent : 50}
            indeterminate={binaryProgress.percent < 0 || binaryProgress.phase !== 'downloading'}
          />
        </div>
      )}

      <JobQueue types={['image-upscale']} />

      {/* Comparador deslizante antes / después */}
      <section className="queue-panel">
        <header>
          <h2>{t('aiImages.compare')}</h2>
        </header>
        {compare ? (
          <BeforeAfterSlider beforeSrc={compare.before} afterSrc={compare.after} />
        ) : (
          <div className="empty-state">{t('aiImages.compareHint')}</div>
        )}
      </section>
    </div>
  )
}
