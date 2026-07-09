/**
 * Tipado global de window.api para el renderer.
 */
import type { Api } from './index'

declare global {
  interface Window {
    api: Api
  }
}

export {}
