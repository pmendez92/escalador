/**
 * useSettings — contexto global de ajustes.
 *
 * Carga los ajustes del backend al montar y expone `update()` que persiste
 * y refresca el estado. También aplica el tema (data-theme en <html>)
 * reaccionando al modo "system" con matchMedia.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import type { AppSettings } from '@shared/types'

interface SettingsContextValue {
  settings: AppSettings | null
  update: (partial: Partial<AppSettings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  update: async () => {}
})

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
  }, [])

  // Aplicar el tema al documento cada vez que cambie el ajuste.
  useEffect(() => {
    if (!settings) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = (): void => {
      const resolved =
        settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
      document.documentElement.setAttribute('data-theme', resolved)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings])

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    const next = await window.api.setSettings(partial)
    setSettings(next)
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext)
}
