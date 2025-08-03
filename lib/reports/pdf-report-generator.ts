import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { EnhancementReport } from './types'
import { uploadFile } from '@/lib/r2'

export class PDFReportGenerator {
  private readonly colors = {
    primary: rgb(0.231, 0.318, 0.961), // #3b51f5
    secondary: rgb(0.392, 0.584, 0.929), // #6495ed
    text: rgb(0.067, 0.075, 0.09), // #111318
    gray: rgb(0.4, 0.4, 0.4),
    lightGray: rgb(0.9, 0.9, 0.9),
    success: rgb(0.13, 0.81, 0.53), // #22c55e
    white: rgb(1, 1, 1)
  }

  async generatePDFReport(report: EnhancementReport): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create()
    
    // Set metadata
    pdfDoc.setTitle(`Enhancement Report - ${report.documentInfo.name}`)
    pdfDoc.setAuthor('BeautifyAI')
    pdfDoc.setCreator('BeautifyAI Report Generator')
    pdfDoc.setProducer('BeautifyAI Platform')
    pdfDoc.setCreationDate(new Date())
    
    // Add fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    // Create pages
    await this.createCoverPage(pdfDoc, report, helvetica, helveticaBold)
    await this.createSummaryPage(pdfDoc, report, helvetica, helveticaBold)
    await this.createComparisonPage(pdfDoc, report, helvetica, helveticaBold)
    await this.createEnhancementsPage(pdfDoc, report, helvetica, helveticaBold)
    await this.createInsightsPage(pdfDoc, report, helvetica, helveticaBold)
    
    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()
    return Buffer.from(pdfBytes)
  }

  private async createCoverPage(
    pdfDoc: PDFDocument,
    report: EnhancementReport,
    helvetica: any,
    helveticaBold: any
  ): Promise<void> {
    const page = pdfDoc.addPage()
    const { width, height } = page.getSize()
    const centerX = width / 2

    // Background gradient effect
    page.drawRectangle({
      x: 0,
      y: height - 200,
      width: width,
      height: 200,
      color: this.colors.lightGray
    })

    // Title
    page.drawText('Enhancement Report', {
      x: centerX - 120,
      y: height - 100,
      size: 32,
      font: helveticaBold,
      color: this.colors.primary
    })

    // Document name
    page.drawText(report.documentInfo.name, {
      x: centerX - 100,
      y: height - 140,
      size: 18,
      font: helvetica,
      color: this.colors.text
    })

    // Date
    page.drawText(`Generated on ${report.generatedAt.toLocaleDateString()}`, {
      x: centerX - 80,
      y: height - 170,
      size: 12,
      font: helvetica,
      color: this.colors.gray
    })

    // Overall improvement score
    const improvement = report.comparison.improvements.overallImprovement
    const scoreColor = improvement > 20 ? this.colors.success : this.colors.secondary
    
    page.drawText(`+${improvement}`, {
      x: centerX - 40,
      y: height / 2,
      size: 72,
      font: helveticaBold,
      color: scoreColor
    })

    page.drawText('Overall Improvement', {
      x: centerX - 60,
      y: height / 2 - 30,
      size: 14,
      font: helvetica,
      color: this.colors.text
    })

    // Footer
    page.drawText('Powered by BeautifyAI', {
      x: centerX - 60,
      y: 50,
      size: 10,
      font: helvetica,
      color: this.colors.gray
    })
  }

  private async createSummaryPage(
    pdfDoc: PDFDocument,
    report: EnhancementReport,
    helvetica: any,
    helveticaBold: any
  ): Promise<void> {
    const page = pdfDoc.addPage()
    const { _width, height } = page.getSize()
    let yPosition = height - 80

    // Page title
    page.drawText('Executive Summary', {
      x: 50,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: this.colors.primary
    })
    yPosition -= 40

    // Key metrics
    const metrics = [
      { label: 'Documents Enhanced', value: '1' },
      { label: 'Enhancements Applied', value: report.enhancements.totalCount.toString() },
      { label: 'Processing Time', value: `${report.metadata.processingTime}ms` },
      { label: 'Engagement Prediction', value: `${report.engagement.predictedScore}%` }
    ]

    metrics.forEach((metric, index) => {
      const x = 50 + (index % 2) * 250
      const y = yPosition - Math.floor(index / 2) * 60
      
      page.drawText(metric.value, {
        x,
        y,
        size: 28,
        font: helveticaBold,
        color: this.colors.primary
      })
      
      page.drawText(metric.label, {
        x,
        y: y - 20,
        size: 12,
        font: helvetica,
        color: this.colors.gray
      })
    })
    yPosition -= 140

    // Audience impact
    page.drawText('Target Audience Impact', {
      x: 50,
      y: yPosition,
      size: 18,
      font: helveticaBold,
      color: this.colors.text
    })
    yPosition -= 30

    page.drawText(report.engagement.audienceImpact.targetAudience, {
      x: 50,
      y: yPosition,
      size: 14,
      font: helvetica,
      color: this.colors.text
    })
    yPosition -= 25

    page.drawText(`Engagement Likelihood: ${report.engagement.audienceImpact.engagementLikelihood.toUpperCase()}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: helvetica,
      color: this.colors.secondary
    })
    yPosition -= 40

    // Key improvements
    page.drawText('Key Improvements', {
      x: 50,
      y: yPosition,
      size: 18,
      font: helveticaBold,
      color: this.colors.text
    })
    yPosition -= 25

    report.engagement.audienceImpact.keyImprovements.slice(0, 3).forEach(improvement => {
      page.drawText(`• ${improvement}`, {
        x: 60,
        y: yPosition,
        size: 12,
        font: helvetica,
        color: this.colors.text
      })
      yPosition -= 20
    })
  }

  private async createComparisonPage(
    pdfDoc: PDFDocument,
    report: EnhancementReport,
    helvetica: any,
    helveticaBold: any
  ): Promise<void> {
    const page = pdfDoc.addPage()
    const { _width, height } = page.getSize()
    let yPosition = height - 80

    // Page title
    page.drawText('Before & After Comparison', {
      x: 50,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: this.colors.primary
    })
    yPosition -= 60

    // Score comparison table
    const categories = [
      { name: 'Overall Score', before: report.comparison.before.overallScore, after: report.comparison.after.overallScore },
      { name: 'Visual Appeal', before: report.comparison.before.visualAppeal, after: report.comparison.after.visualAppeal },
      { name: 'Readability', before: report.comparison.before.readability, after: report.comparison.after.readability },
      { name: 'Engagement', before: report.comparison.before.engagement, after: report.comparison.after.engagement },
      { name: 'Color Harmony', before: report.comparison.before.colorHarmony, after: report.comparison.after.colorHarmony },
      { name: 'Layout Score', before: report.comparison.before.layoutScore, after: report.comparison.after.layoutScore }
    ]

    // Table headers
    page.drawText('Category', { x: 50, y: yPosition, size: 12, font: helveticaBold, color: this.colors.text })
    page.drawText('Before', { x: 250, y: yPosition, size: 12, font: helveticaBold, color: this.colors.text })
    page.drawText('After', { x: 350, y: yPosition, size: 12, font: helveticaBold, color: this.colors.text })
    page.drawText('Change', { x: 450, y: yPosition, size: 12, font: helveticaBold, color: this.colors.text })
    yPosition -= 25

    // Table rows
    categories.forEach(cat => {
      const change = cat.after - cat.before
      const changeColor = change > 0 ? this.colors.success : this.colors.gray
      
      page.drawText(cat.name, { x: 50, y: yPosition, size: 11, font: helvetica, color: this.colors.text })
      page.drawText(cat.before.toString(), { x: 250, y: yPosition, size: 11, font: helvetica, color: this.colors.gray })
      page.drawText(cat.after.toString(), { x: 350, y: yPosition, size: 11, font: helvetica, color: this.colors.text })
      page.drawText(`+${change}`, { x: 450, y: yPosition, size: 11, font: helvetica, color: changeColor })
      yPosition -= 20
    })
  }

  private async createEnhancementsPage(
    pdfDoc: PDFDocument,
    report: EnhancementReport,
    helvetica: any,
    helveticaBold: any
  ): Promise<void> {
    const page = pdfDoc.addPage()
    const { _width, height } = page.getSize()
    let yPosition = height - 80

    // Page title
    page.drawText('Applied Enhancements', {
      x: 50,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: this.colors.primary
    })
    yPosition -= 40

    // Enhancement breakdown
    const categories = Object.entries(report.enhancements.byCategory)
    categories.forEach(([category, count]) => {
      if (count > 0) {
        page.drawText(`${category.charAt(0).toUpperCase() + category.slice(1)}: ${count} enhancements`, {
          x: 50,
          y: yPosition,
          size: 14,
          font: helvetica,
          color: this.colors.text
        })
        yPosition -= 25
      }
    })
    yPosition -= 20

    // List top enhancements
    page.drawText('Enhancement Details', {
      x: 50,
      y: yPosition,
      size: 18,
      font: helveticaBold,
      color: this.colors.text
    })
    yPosition -= 30

    report.enhancements.applied.slice(0, 5).forEach(enhancement => {
      // Enhancement name
      page.drawText(enhancement.name, {
        x: 50,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: this.colors.secondary
      })
      yPosition -= 20

      // Enhancement description
      const description = this.wrapText(enhancement.description, 60)
      description.forEach(line => {
        page.drawText(line, {
          x: 60,
          y: yPosition,
          size: 10,
          font: helvetica,
          color: this.colors.text
        })
        yPosition -= 15
      })
      
      // Impact
      const impactColor = enhancement.impact === 'high' ? this.colors.success : 
                         enhancement.impact === 'medium' ? this.colors.secondary : this.colors.gray
      page.drawText(`Impact: ${enhancement.impact.toUpperCase()}`, {
        x: 60,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: impactColor
      })
      yPosition -= 30
    })
  }

  private async createInsightsPage(
    pdfDoc: PDFDocument,
    report: EnhancementReport,
    helvetica: any,
    helveticaBold: any
  ): Promise<void> {
    const page = pdfDoc.addPage()
    const { width, height } = page.getSize()
    let yPosition = height - 80

    // Page title
    page.drawText('Educational Insights', {
      x: 50,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: this.colors.primary
    })
    yPosition -= 40

    // Insights
    report.insights.slice(0, 4).forEach(insight => {
      // Insight title
      page.drawText(insight.title, {
        x: 50,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: this.colors.secondary
      })
      yPosition -= 20

      // Description
      const description = this.wrapText(insight.description, 70)
      description.forEach(line => {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 10,
          font: helvetica,
          color: this.colors.text
        })
        yPosition -= 15
      })

      // Tip
      page.drawText('💡 Tip:', {
        x: 50,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: this.colors.text
      })
      
      const tip = this.wrapText(insight.tip, 65)
      tip.forEach(line => {
        page.drawText(line, {
          x: 90,
          y: yPosition,
          size: 10,
          font: helvetica,
          color: this.colors.gray
        })
        yPosition -= 15
      })
      yPosition -= 20
    })

    // Footer
    page.drawText('Continue learning at beautifyai.com/learn', {
      x: width / 2 - 100,
      y: 50,
      size: 10,
      font: helvetica,
      color: this.colors.secondary
    })
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    words.forEach(word => {
      if (currentLine.length + word.length + 1 <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })

    if (currentLine) lines.push(currentLine)
    return lines
  }

  async uploadReport(
    pdfBuffer: Buffer,
    reportId: string,
    userId: string
  ): Promise<string> {
    const fileName = `report-${reportId}.pdf`
    const path = `reports/${userId}/${fileName}`
    
    return await uploadFile(pdfBuffer, path, 'application/pdf')
  }
}