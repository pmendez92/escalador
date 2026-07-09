/**
 * Declaraciones de tipos para paquetes sin tipados propios.
 */
declare module 'ffmpeg-static' {
  const path: string | null
  export default path
}

declare module 'ffprobe-static' {
  const ffprobe: { path: string }
  export default ffprobe
}

declare module 'png-to-ico' {
  function pngToIco(input: Buffer | string | Array<Buffer | string>): Promise<Buffer>
  export default pngToIco
}
