/**
 * useI18n — internacionalización ligera sin dependencias.
 *
 * Los textos viven en /locales/*.json con claves planas ("nav.home").
 * El idioma activo sale de los ajustes globales; `t(key)` devuelve la clave
 * si falta la traducción (fácil de detectar en desarrollo).
 */
import { createContext, useContext, type ReactNode } from 'react'
import es from '../locales/es.json'
import en from '../locales/en.json'
import { useSettings } from './useSettings'

type Dictionary = Record<string, string>
const DICTIONARIES: Record<'es' | 'en', Dictionary> = { es, en }

const I18nContext = createContext<(key: string) => string>((k) => k)

export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { settings } = useSettings()
  const dict = DICTIONARIES[settings?.language ?? 'es']
  const t = (key: string): string => dict[key] ?? key
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>
}

export function useI18n(): (key: string) => string {
  return useContext(I18nContext)
}
