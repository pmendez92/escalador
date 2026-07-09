/**
 * FileList — lista de archivos seleccionados con opción de quitarlos.
 */
import { FileIcon, X } from 'lucide-react'
import { fileName } from '../utils/format'

interface FileListProps {
  files: string[]
  onRemove: (path: string) => void
}

export function FileList({ files, onRemove }: FileListProps): React.JSX.Element | null {
  if (files.length === 0) return null
  return (
    <div className="file-list">
      {files.map((f) => (
        <div key={f} className="file-row">
          <FileIcon size={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <span className="name" title={f}>
            {fileName(f)}
          </span>
          <button className="btn ghost sm" onClick={() => onRemove(f)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
