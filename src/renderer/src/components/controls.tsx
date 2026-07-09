/**
 * Controles básicos reutilizables: Select, Toggle, campo de carpeta de salida
 * y barra de progreso. Mantenerlos juntos evita microficheros (KISS).
 */
import { FolderOpen } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'

/* ---------------- Select ---------------- */

interface SelectProps<T extends string> {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange
}: SelectProps<T>): React.JSX.Element {
  return (
    <div className="field">
      <label>{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ---------------- Toggle ---------------- */

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function Toggle({ checked, onChange, label }: ToggleProps): React.JSX.Element {
  const control = (
    <button
      type="button"
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
    />
  )
  if (!label) return control
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
      {control}
      {label}
    </label>
  )
}

/* ---------------- Carpeta de salida ---------------- */

interface OutputFolderProps {
  value: string
  onChange: (dir: string) => void
}

export function OutputFolderField({ value, onChange }: OutputFolderProps): React.JSX.Element {
  const t = useI18n()
  const pick = async (): Promise<void> => {
    const dir = await window.api.selectDirectory()
    if (dir) onChange(dir)
  }
  return (
    <div className="field" style={{ minWidth: 260 }}>
      <label>{t('common.outputFolder')}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={value} readOnly title={value} />
        <button className="btn" onClick={pick} title={t('common.change')}>
          <FolderOpen size={15} />
        </button>
      </div>
    </div>
  )
}

/* ---------------- Barra de progreso ---------------- */

interface ProgressBarProps {
  percent: number
  status?: 'running' | 'completed' | 'error'
  indeterminate?: boolean
}

export function ProgressBar({ percent, status, indeterminate }: ProgressBarProps): React.JSX.Element {
  const cls =
    status === 'completed' ? 'success' : status === 'error' ? 'error' : ''
  return (
    <div className="progress">
      <div
        className={`progress-fill ${cls} ${indeterminate ? 'indeterminate' : ''}`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  )
}
