/**
 * Utilidades de entorno del proceso principal.
 */
import { app } from 'electron'

export const is = {
  get dev(): boolean {
    return !app.isPackaged
  }
}
