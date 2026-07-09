/**
 * Descarga de archivos por HTTPS con progreso y soporte de redirecciones
 * (GitHub Releases redirige a un CDN). Sin dependencias externas: usa
 * el módulo `https` de Node.
 */
import https from 'https'
import { createWriteStream, promises as fs } from 'fs'
import path from 'path'

export interface DownloadProgress {
  downloadedBytes: number
  totalBytes: number
  /** 0..100, -1 si el servidor no informa del tamaño */
  percent: number
}

const MAX_REDIRECTS = 10

export async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  await fs.mkdir(path.dirname(destPath), { recursive: true })

  let currentUrl = url
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const result = await requestOnce(currentUrl, destPath, onProgress, signal)
    if (result.redirectTo) {
      currentUrl = result.redirectTo
      continue
    }
    return
  }
  throw new Error(`Demasiadas redirecciones descargando ${url}`)
}

function requestOnce(
  url: string,
  destPath: string,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<{ redirectTo?: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'escalador-app' }, signal },
      (res) => {
        // Redirecciones 3xx
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          resolve({ redirectTo: new URL(res.headers.location, url).toString() })
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode} descargando ${url}`))
          return
        }

        const totalBytes = Number(res.headers['content-length'] ?? 0)
        let downloadedBytes = 0
        const file = createWriteStream(destPath)

        res.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length
          onProgress?.({
            downloadedBytes,
            totalBytes,
            percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : -1
          })
        })
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve({})))
        file.on('error', (err) => {
          file.close()
          reject(err)
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
  })
}
