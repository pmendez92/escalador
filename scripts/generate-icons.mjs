/**
 * Genera resources/icon.png (512×512) a partir de resources/icon.svg usando
 * sharp. electron-builder deriva de este PNG el .ico (Windows) y .icns (macOS).
 *
 * Uso: npm run icons   (se ejecuta también desde scripts/setup.*)
 */
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

await sharp(join(root, 'resources', 'icon.svg'))
  .resize(512, 512)
  .png()
  .toFile(join(root, 'resources', 'icon.png'))

console.log('✔ resources/icon.png generado (512×512)')
