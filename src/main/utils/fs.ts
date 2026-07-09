/**
 * Utilidades de sistema de archivos usadas por los ejecutores.
 */
import { promises as fs } from 'fs'
import { app } from 'electron'
import path from 'path'
import crypto from 'crypto'

/** Crea el directorio (recursivo) si no existe y lo devuelve. */
export async function ensureDir(dir: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/**
 * Devuelve una ruta de salida que no pisa archivos existentes:
 * "foto.png" → "foto (1).png" → "foto (2).png"…
 */
export async function uniqueOutputPath(dir: string, baseName: string, ext: string): Promise<string> {
  let candidate = path.join(dir, `${baseName}.${ext}`)
  let counter = 1
  while (await exists(candidate)) {
    candidate = path.join(dir, `${baseName} (${counter}).${ext}`)
    counter++
  }
  return candidate
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/** Directorio temporal propio de la app (se limpia por trabajo). */
export async function createTempDir(prefix: string): Promise<string> {
  const base = path.join(app.getPath('temp'), 'escalador')
  await fs.mkdir(base, { recursive: true })
  return fs.mkdtemp(path.join(base, `${prefix}-`))
}

export async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true })
}

/** SHA-256 de un archivo (verificación de integridad de binarios/modelos). */
export async function sha256File(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

/** Nombre base sin extensión. */
export function baseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath))
}
