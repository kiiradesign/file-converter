import { jsPDF } from 'jspdf'

/** Wrap ImageData as a single-page PDF (embedded PNG). */
export async function encodePdf(imageData: ImageData): Promise<Blob> {
  const { width, height } = imageData
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')
  ctx.putImageData(imageData, 0, 0)

  const dataUrl = canvas.toDataURL('image/png')
  const orientation = width >= height ? 'landscape' : 'portrait'
  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [width, height],
    compress: true,
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, width, height, undefined, 'FAST')
  return pdf.output('blob')
}
