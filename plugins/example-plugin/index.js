/**
 * Plugin de ejemplo para Escalador.
 *
 * Instalación: copia esta carpeta a  <userData>/plugins/example-plugin
 *   Windows: %APPDATA%/escalador/plugins/
 *   macOS:   ~/Library/Application Support/escalador/plugins/
 *   Linux:   ~/.config/escalador/plugins/
 *
 * El contexto expone:
 *   - registerExecutor(executor): añade un nuevo tipo de trabajo a la cola.
 *   - log(message): escribe en el log de la aplicación.
 */
'use strict'

module.exports.activate = function activate(context) {
  context.log('Plugin de ejemplo activado')

  // Ejemplo: un ejecutor ficticio que "procesa" durante 3 segundos.
  // Un plugin real haría aquí su trabajo (otro códec, un filtro, una API…).
  context.registerExecutor({
    type: 'example-noop',
    async execute(job, ctx) {
      for (let i = 1; i <= 3; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        ctx.reportProgress({ percent: (i / 3) * 100, phase: 'Plugin de ejemplo' })
      }
      return { outputPath: job.outputDir }
    }
  })
}
