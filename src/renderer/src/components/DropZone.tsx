/**
 * DropZone — zona de arrastrar y soltar + selector de archivos.
 *
 * Acepta solo las extensiones indicadas; obtiene la ruta real de cada File
 * mediante el preload (webUtils.getPathForFile), único método soportado con
 * contextIsolation.
 */
import { useCallback, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'

interface DropZoneProps {
  /** Extensiones sin punto: ['png', 'jpg'…] */
  extensions: string[]
  /** Nombre del filtro del diálogo nativo ("Imágenes") */
  filterName: string
  onFiles: (paths: string[]) => void
}

export function DropZone({ extensions, filterName, onFiles }: DropZoneProps): React.JSX.Element {
  const t = useI18n()
  const [dragging, setDragging] = useState(false)

  const accept = useCallback(
    (paths: string[]) => {
      const valid = paths.filter((p) => {
        const ext = p.split('.').pop()?.toLowerCase() ?? ''
        return extensions.includes(ext)
      })
      if (valid.length > 0) onFiles(valid)
    },
    [extensions, onFiles]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const paths = Array.from(e.dataTransfer.files).map((f) => window.api.getPathForFile(f))
      accept(paths)
    },
    [accept]
  )

  const handleClick = useCallback(async () => {
    const paths = await window.api.selectFiles([{ name: filterName, extensions }])
    accept(paths)
  }, [accept, extensions, filterName])

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onClick={handleClick}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <UploadCloud size={36} className="dz-icon" />
      <strong>{t('common.dropHere')}</strong>
      <span>{t('common.orClick')}</span>
      <span className="hint">{extensions.map((e) => `.${e}`).join('  ')}</span>
    </div>
  )
}
