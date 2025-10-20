import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

/**
 * Generate a tiny fallback PDF for E2E testing
 * Returns a Buffer containing a valid PDF
 */
export async function generateFallbackPDF(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([400, 300])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  page.drawText("E2E Test Fallback PDF", {
    x: 50,
    y: 250,
    size: 20,
    font,
    color: rgb(0, 0, 0),
  })

  page.drawText("This is a generated fallback document for testing.", {
    x: 50,
    y: 220,
    size: 12,
    font,
    color: rgb(0.5, 0.5, 0.5),
  })

  page.drawText("No storage configured - using test mode.", {
    x: 50,
    y: 200,
    size: 10,
    font,
    color: rgb(0.7, 0.7, 0.7),
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
