/** Tamanho final do ícone de uma app (quadrado). */
export const ICON_SIZE = 256
const MAX_INPUT_BYTES = 8 * 1024 * 1024

/**
 * Converte uma imagem num ícone quadrado 1:1: corta ao centro, reduz para 256x256
 * e devolve um data URL (WebP quando o browser suporta, senão PNG).
 */
export async function fileToSquareIcon(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolhe um ficheiro de imagem (PNG, JPG, WebP ou SVG).')
  if (file.size > MAX_INPUT_BYTES) throw new Error('A imagem é demasiado grande (máximo 8 MB).')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
      i.src = url
    })
    const w = img.naturalWidth || ICON_SIZE
    const h = img.naturalHeight || ICON_SIZE
    const side = Math.min(w, h)
    const canvas = document.createElement('canvas')
    canvas.width = ICON_SIZE
    canvas.height = ICON_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, ICON_SIZE, ICON_SIZE)
    let data = canvas.toDataURL('image/webp', 0.9)
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/png')
    return data
  } finally {
    URL.revokeObjectURL(url)
  }
}
