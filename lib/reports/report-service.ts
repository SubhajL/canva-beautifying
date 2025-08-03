import { createClient } from '@/lib/supabase/server'
import { ComparisonGenerator } from './comparison-generator'
import { EnhancementListGenerator } from './enhancement-list-generator'
import { EngagementPredictor } from './engagement-predictor'
import { EducationalInsightsGenerator } from './educational-insights'
import { PDFReportGenerator } from './pdf-report-generator'
import { 
  EnhancementReport, 
  ReportGenerationOptions,
  ShareableReportLink,
  ReportCustomization 
} from './types'
import { nanoid } from 'nanoid'

export class ReportService {
  private comparisonGenerator: ComparisonGenerator
  private enhancementListGenerator: EnhancementListGenerator
  private engagementPredictor: EngagementPredictor
  private insightsGenerator: EducationalInsightsGenerator
  private pdfGenerator: PDFReportGenerator

  constructor() {
    this.comparisonGenerator = new ComparisonGenerator()
    this.enhancementListGenerator = new EnhancementListGenerator()
    this.engagementPredictor = new EngagementPredictor()
    this.insightsGenerator = new EducationalInsightsGenerator()
    this.pdfGenerator = new PDFReportGenerator()
  }

  async generateReport(options: ReportGenerationOptions): Promise<EnhancementReport> {
    const startTime = Date.now()
    
    // Get document info from database
    const documentInfo = await this.getDocumentInfo(options.documentId, options.userId)
    
    // Generate comparison data
    const comparison = await this.comparisonGenerator.generateComparison(
      options.analysisData.before,
      options.analysisData.after,
      documentInfo.originalUrl,
      documentInfo.enhancedUrl
    )
    
    // Generate enhancement list
    const enhancements = this.enhancementListGenerator.generateEnhancementList(
      options.enhancementData.strategies,
      options.enhancementData.appliedStrategies
    )
    
    // Predict engagement
    const engagement = this.engagementPredictor.predictEngagement(
      options.analysisData.before,
      options.analysisData.after,
      comparison.improvements
    )
    
    // Generate educational insights
    const insights = this.insightsGenerator.generateInsights(
      enhancements.applied,
      engagement.audienceImpact.targetAudience
    )
    
    // Create report
    const report: EnhancementReport = {
      id: nanoid(),
      documentId: options.documentId,
      userId: options.userId,
      generatedAt: new Date(),
      documentInfo,
      comparison,
      enhancements: {
        ...enhancements,
        strategies: options.enhancementData.strategies
      },
      engagement,
      insights,
      metadata: {
        reportVersion: '1.0',
        processingTime: Date.now() - startTime,
        generationMethod: 'automatic',
        customizations: options.customization
      }
    }
    
    // Store report in database
    await this.storeReport(report)
    
    return report
  }

  async exportReportAsPDF(reportId: string, userId: string): Promise<string> {
    // Get report from database
    const report = await this.getReport(reportId, userId)
    if (!report) {
      throw new Error('Report not found')
    }
    
    // Generate PDF
    const pdfBuffer = await this.pdfGenerator.generatePDFReport(report)
    
    // Upload and return URL
    return await this.pdfGenerator.uploadReport(pdfBuffer, reportId, userId)
  }

  async createShareableLink(
    reportId: string,
    userId: string,
    expiresInDays: number = 7,
    password?: string
  ): Promise<ShareableReportLink> {
    const supabase = await createClient()
    
    // Verify report ownership
    const report = await this.getReport(reportId, userId)
    if (!report) {
      throw new Error('Report not found')
    }
    
    // Create shareable link
    const shareableLink: ShareableReportLink = {
      id: nanoid(),
      reportId,
      shortCode: nanoid(10),
      url: `${process.env.NEXT_PUBLIC_APP_URL}/reports/shared/${nanoid(10)}`,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      accessCount: 0,
      password,
      createdAt: new Date()
    }
    
    // Store in database
    await supabase.from('shareable_report_links').insert({
      id: shareableLink.id,
      report_id: reportId,
      short_code: shareableLink.shortCode,
      expires_at: shareableLink.expiresAt,
      password: password ? await this.hashPassword(password) : null,
      created_by: userId
    })
    
    return shareableLink
  }

  async getReportByShareCode(shortCode: string, password?: string): Promise<EnhancementReport | null> {
    const supabase = await createClient()
    
    // Get shareable link
    const { data: link } = await supabase
      .from('shareable_report_links')
      .select('*')
      .eq('short_code', shortCode)
      .single()
    
    if (!link) return null
    
    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return null
    }
    
    // Check password
    if (link.password && password) {
      const isValid = await this.verifyPassword(password, link.password)
      if (!isValid) return null
    } else if (link.password && !password) {
      throw new Error('Password required')
    }
    
    // Increment access count
    await supabase
      .from('shareable_report_links')
      .update({ access_count: link.access_count + 1 })
      .eq('id', link.id)
    
    // Get and return report
    return await this.getReportById(link.report_id)
  }

  async getUserReports(userId: string, limit: number = 50): Promise<EnhancementReport[]> {
    const supabase = await createClient()
    
    const { data: reports } = await supabase
      .from('enhancement_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    return (reports || []).map(r => this.parseStoredReport(r))
  }

  private async getDocumentInfo(documentId: string, userId: string): Promise<EnhancementReport['documentInfo']> {
    const supabase = await createClient()
    
    const { data: enhancement } = await supabase
      .from('enhancements')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single()
    
    if (!enhancement) {
      throw new Error('Document not found')
    }
    
    return {
      name: enhancement.metadata?.fileName || 'Untitled Document',
      originalUrl: enhancement.original_url,
      enhancedUrl: enhancement.enhanced_url,
      documentType: this.inferDocumentType(enhancement.metadata),
      originalSize: enhancement.metadata?.fileSize || 0,
      enhancedSize: enhancement.metadata?.enhancedSize || 0
    }
  }

  private inferDocumentType(metadata: any): EnhancementReport['documentInfo']['documentType'] {
    if (!metadata?.documentType) return 'other'
    
    const type = metadata.documentType.toLowerCase()
    if (type.includes('worksheet')) return 'worksheet'
    if (type.includes('presentation')) return 'presentation'
    if (type.includes('poster')) return 'poster'
    if (type.includes('flyer')) return 'flyer'
    return 'other'
  }

  private async storeReport(report: EnhancementReport): Promise<void> {
    const supabase = await createClient()
    
    await supabase.from('enhancement_reports').insert({
      id: report.id,
      document_id: report.documentId,
      user_id: report.userId,
      report_data: report,
      created_at: report.generatedAt
    })
  }

  private async getReport(reportId: string, userId: string): Promise<EnhancementReport | null> {
    const supabase = await createClient()
    
    const { data: report } = await supabase
      .from('enhancement_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', userId)
      .single()
    
    return report ? this.parseStoredReport(report) : null
  }

  private async getReportById(reportId: string): Promise<EnhancementReport | null> {
    const supabase = await createClient()
    
    const { data: report } = await supabase
      .from('enhancement_reports')
      .select('*')
      .eq('id', reportId)
      .single()
    
    return report ? this.parseStoredReport(report) : null
  }

  private parseStoredReport(stored: any): EnhancementReport {
    const reportData = stored.report_data
    return {
      ...reportData,
      generatedAt: new Date(reportData.generatedAt)
    }
  }

  private async hashPassword(password: string): Promise<string> {
    // In production, use bcrypt or similar
    // For now, simple base64 encoding
    return Buffer.from(password).toString('base64')
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    // In production, use bcrypt or similar
    return Buffer.from(password).toString('base64') === hash
  }

  async applyCustomization(
    report: EnhancementReport,
    customization: ReportCustomization
  ): Promise<EnhancementReport> {
    // Apply customization filters
    const customizedReport = { ...report }
    
    if (!customization.includeScreenshots) {
      customizedReport.comparison.before.screenshot = undefined
      customizedReport.comparison.after.screenshot = undefined
    }
    
    if (customization.detailLevel === 'summary') {
      // Limit enhancements to top 3
      customizedReport.enhancements.applied = customizedReport.enhancements.applied.slice(0, 3)
      // Limit insights to top 3
      customizedReport.insights = customizedReport.insights.slice(0, 3)
    }
    
    if (!customization.includeTechnicalDetails) {
      // Remove technical details from enhancements
      customizedReport.enhancements.applied = customizedReport.enhancements.applied.map(e => ({
        ...e,
        beforeValue: undefined,
        afterValue: undefined
      }))
    }
    
    if (!customization.includeEducationalContent) {
      customizedReport.insights = []
    }
    
    if (customization.focusAreas && customization.focusAreas.length > 0) {
      // Filter enhancements by focus areas
      customizedReport.enhancements.applied = customizedReport.enhancements.applied.filter(
        e => customization.focusAreas!.includes(e.category)
      )
    }
    
    // Update metadata
    customizedReport.metadata.customizations = customization
    
    return customizedReport
  }
}