/**
 * Hook afterSign de electron-builder — firma ad-hoc gratuita en macOS.
 *
 * electron-builder por defecto SALTA la firma por completo si no encuentra
 * un certificado "Developer ID Application" (de pago, cuenta Apple
 * Developer). Sin firma alguna, macOS con Apple Silicon (M1/M2/M3) se
 * niega a abrir la app ("está dañada"), sin ni siquiera ofrecer el botón
 * "Abrir de todas formas" de Gatekeeper.
 *
 * `codesign --sign -` aplica una firma "ad-hoc": válida para que el
 * sistema acepte ejecutar el binario, gratuita, sin cuenta de pago ni
 * certificado. Con ella, solo queda el aviso normal de cuarentena de
 * Gatekeeper (saltable con clic derecho → Abrir).
 *
 * Solo se ejecuta al empaquetar para macOS (afterSign no se invoca en
 * otras plataformas).
 */
const { execFileSync } = require('child_process')
const path = require('path')

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  console.log(`[adhoc-sign] Firmando ad-hoc (gratuita): ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  console.log('[adhoc-sign] Firma ad-hoc aplicada correctamente')
}
