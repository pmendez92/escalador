/**
 * Configuración de electron-vite.
 *
 * Compila tres bundles independientes:
 *  - main:     proceso principal de Electron (backend Node.js)
 *  - preload:  puente seguro entre main y renderer (contextBridge)
 *  - renderer: interfaz React (Vite + HMR en desarrollo)
 *
 * Las dependencias nativas (sharp, ffmpeg-static…) se externalizan para que
 * Node las cargue en tiempo de ejecución en lugar de intentar empaquetarlas.
 */
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    }
  }
})
