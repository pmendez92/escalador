/**
 * ImageConvertPage — conversor de imágenes por lotes.
 *
 * Flujo: soltar/seleccionar archivos → elegir formato, calidad, carpeta y
 * opciones de metadatos → "Convertir" encola un trabajo por archivo.
 */
import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { IMAGE_INPUT_EXTENSIONS, IMAGE_TARGET_FORMATS } from '@shared/formats'
import type { ImageConvertOptions, ImageTargetFormat } from '@shared/types'
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

export function ImageConvertPage({ initialFiles, onConsumeInitial }: Props): React.JSX.Element {
  const t = useI18n()
  const { settings } = useSettings()
  const { enqueue } = useJobs()

  const [files, setFiles] = useState<string[]>([])
  const [format, setFormat] = useState<ImageTargetFormat>('webp')
  const [quality, setQuality] = useState(90)
  const [outputDir, setOutputDir] = useState('')
  const [keepMetadata, setKeepMetadata] = useState(true)
  const [stripMetadata, setStripMetadata] = useState(false)
  const [compress, setCompress] = useState(false)

  // Carpeta por defecto desde ajustes.
  useEffect(() => {
    if (settings && !outputDir) setOutputDir(settings.outputDir)
  }, [settings, outputDir])

  // Archivos entrantes desde el clic derecho del Explorador.
  useEffect(() => {
    if (initialFiles.length > 0) {
      setFiles((prev) => [...new Set([...prev, ...initialFiles])])
      onConsumeInitial()
    }
  }, [initialFiles, onConsumeInitial])

  const convert = async (): Promise<void> => {
    const options: ImageConvertOptions = {
      targetFormat: format,
      quality,
      keepMetadata,
      stripMetadata,
      compress
    }
    // Un trabajo por archivo: la cola gestiona la concurrencia.
    for (const inputPath of files) {
      await enqueue({ type: 'image-convert', inputPath, outputDir, options })
    }
    setFiles([])
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('images.title')}</h1>
        <p>{t('images.subtitle')}</p>
      </header>

      <DropZone
        extensions={IMAGE_INPUT_EXTENSIONS}
        filterName="Imágenes"
        onFiles={(paths) => setFiles((prev) => [...new Set([...prev, ...paths])])}
      />
      <FileList files={files} onRemove={(p) => setFiles((prev) => prev.filter((f) => f !== p))} />

      <div className="options-bar">
        <Select
          label={t('common.format')}
          value={format}
          options={IMAGE_TARGET_FORMATS.map((f) => ({ value: f.id, label: f.label }))}
          onChange={setFormat}
        />
        <div className="field" style={{ width: 130 }}>
          <label>
            {t('common.quality')} ({quality})
          </label>
          <input
            className="input"
            type="range"
            min={30}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        </div>
        <OutputFolderField value={outputDir} onChange={setOutputDir} />
        <div className="spacer" />
        <button className="btn primary" disabled={files.length === 0} onClick={() => void convert()}>
          <Play size={15} />
          {t('common.convert')} ({files.length})
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: 8 }}>
        <Toggle checked={keepMetadata && !stripMetadata} onChange={setKeepMetadata} label={t('images.keepMetadata')} />
        <Toggle checked={stripMetadata} onChange={setStripMetadata} label={t('images.stripMetadata')} />
        <Toggle checked={compress} onChange={setCompress} label={t('images.compress')} />
      </div>

      <JobQueue types={['image-convert']} />
    </div>
  )
}
