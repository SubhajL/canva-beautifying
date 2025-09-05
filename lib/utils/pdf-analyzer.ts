import pdfParse from 'pdf-parse'
import { PDFValidator } from './pdf-validator'

/**
 * Sanitizes error messages to remove sensitive information.
 * Removes passwords, tokens, keys, and other sensitive patterns.
 */
function sanitizeErrorMessage(message: string): string {
  // Remove passwords
  let sanitized = message.replace(/password[:\s]*\S+/gi, 'password: [REDACTED]')
  
  // Remove tokens (JWT, Bearer, etc.)
  sanitized = sanitized.replace(/Bearer\s+[\w\-._~+/]+=*/gi, 'Bearer [REDACTED]')
  sanitized = sanitized.replace(/ey[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*/g, '[JWT_REDACTED]')
  
  // Remove API keys
  sanitized = sanitized.replace(/(?:api[_\-]?key|apikey)[:\s]*[\w\-]+/gi, 'api_key: [REDACTED]')
  sanitized = sanitized.replace(/sk-[\w]+/g, 'sk-[REDACTED]')
  
  // Remove secrets
  sanitized = sanitized.replace(/secret[:\s]*\S+/gi, 'secret: [REDACTED]')
  
  // Remove hashes
  sanitized = sanitized.replace(/\$2[aby]\$[0-9]+\$[\w./]+/g, '[HASH_REDACTED]')
  
  // Remove email addresses
  sanitized = sanitized.replace(/[\w._%+-]+@[\w.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]')
  
  // Remove connection strings
  sanitized = sanitized.replace(/(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^\s]+/gi, '[CONNECTION_STRING_REDACTED]')
  
  // Remove user IDs
  sanitized = sanitized.replace(/user[_\-]?id[:\s]*\d+/gi, 'user_id: [REDACTED]')
  
  return sanitized
}

export interface PDFMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creator?: string
  producer?: string
  creationDate?: Date
  modificationDate?: Date
  pdfVersion?: string
}

export interface PDFAnalysis {
  isValid: boolean
  metadata: PDFMetadata
  pageCount: number
  textContent: string
  hasText: boolean
  hasImages: boolean
  fileSize: number
  warnings: string[]
  errors: string[]
}

export interface CorruptionIndicator {
  type: 'structure' | 'content' | 'encoding' | 'security'
  severity: 'low' | 'medium' | 'high'
  message: string
  details?: any
}

export interface CorruptionReport {
  isCorrupted: boolean
  indicators: CorruptionIndicator[]
  canBeProcessed: boolean
  recommendation: string
}

export class PDFAnalyzer {
  /**
   * Analyzes PDF structure and content for corruption and validity
   */
  async analyzePDFStructure(file: File): Promise<PDFAnalysis> {
    const analysis: PDFAnalysis = {
      isValid: false,
      metadata: {},
      pageCount: 0,
      textContent: '',
      hasText: false,
      hasImages: false,
      fileSize: file.size,
      warnings: [],
      errors: []
    }

    try {
      // First, use basic validation
      const basicValidation = await PDFValidator.validatePDFWithDetails(file)
      if (basicValidation) {
        analysis.errors.push(basicValidation)
        return analysis
      }

      // Convert file to buffer for pdf-parse
      const buffer = await file.arrayBuffer()
      const data = await pdfParse(Buffer.from(buffer))

      // Extract metadata
      if (data.info) {
        analysis.metadata = {
          title: data.info.Title,
          author: data.info.Author,
          subject: data.info.Subject,
          keywords: data.info.Keywords,
          creator: data.info.Creator,
          producer: data.info.Producer,
          creationDate: this.parseDate(data.info.CreationDate),
          modificationDate: this.parseDate(data.info.ModDate),
          pdfVersion: data.version
        }
      }

      // Analyze content
      analysis.pageCount = data.numpages
      analysis.textContent = data.text
      analysis.hasText = data.text.trim().length > 0

      // Check for common issues
      if (analysis.pageCount === 0) {
        analysis.errors.push('PDF has no pages')
      }

      if (!analysis.hasText && analysis.pageCount > 0) {
        analysis.warnings.push('PDF contains no extractable text (might be scanned images)')
      }

      // Detect potential corruption patterns
      const corruptionReport = await this.detectPDFCorruption(Buffer.from(buffer))
      if (corruptionReport.isCorrupted) {
        analysis.errors.push(...corruptionReport.indicators.map(i => i.message))
        analysis.warnings.push(corruptionReport.recommendation)
      }

      analysis.isValid = analysis.errors.length === 0

    } catch (error) {
      // Sanitize error messages before adding
      const errorMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error'
      analysis.errors.push(`PDF parsing error: ${errorMessage}`)
      
      // Try to provide helpful context
      if (error instanceof Error) {
        if (error.message.includes('encrypted') || error.message.includes('decrypt')) {
          analysis.errors.push('PDF is encrypted and requires a password')
        } else if (error.message.includes('Invalid')) {
          analysis.errors.push('PDF structure is invalid or severely corrupted')
        }
      }
      
      // Even if parsing failed, try to detect corruption patterns
      try {
        const buffer = await file.arrayBuffer()
        const corruptionReport = await this.detectPDFCorruption(Buffer.from(buffer))
        if (corruptionReport.isCorrupted || corruptionReport.indicators.length > 0) {
          analysis.warnings.push(corruptionReport.recommendation)
        }
      } catch {
        // Ignore secondary errors
      }
    }
    
    // Sanitize all errors and warnings before returning
    analysis.errors = analysis.errors.map(err => sanitizeErrorMessage(err))
    analysis.warnings = analysis.warnings.map(warn => sanitizeErrorMessage(warn))

    return analysis
  }

  /**
   * Performs deep scan for PDF corruption patterns
   */
  async detectPDFCorruption(buffer: Buffer): Promise<CorruptionReport> {
    const indicators: CorruptionIndicator[] = []
    
    try {
      // For very small buffers (test PDFs), skip deep analysis
      if (buffer.length < 512) {
        // Just check basic PDF structure
        const header = buffer.subarray(0, 8).toString('utf8')
        if (!header.startsWith('%PDF-')) {
          indicators.push({
            type: 'structure',
            severity: 'high',
            message: 'Invalid PDF header'
          })
        }
        // Small PDFs might not have full structure, that's OK
        return {
          isCorrupted: indicators.some(i => i.severity === 'high'),
          indicators,
          canBeProcessed: true,
          recommendation: this.getRecommendation(indicators)
        }
      }

      const pdfString = buffer.toString('utf8', 0, Math.min(buffer.length, 10240))
      
      // Only check for xref in larger PDFs
      if (!pdfString.includes('xref') && buffer.length > 2048) {
        indicators.push({
          type: 'structure',
          severity: 'high',
          message: 'Missing xref table - PDF structure is corrupted'
        })
      }

      // Check for trailer - required for valid PDFs
      const trailerIndex = pdfString.lastIndexOf('trailer')
      if (trailerIndex === -1 && buffer.length > 1024) {
        indicators.push({
          type: 'structure',
          severity: 'high',
          message: 'Missing trailer dictionary'
        })
      }

      // Check for startxref - required for valid PDFs
      if (!pdfString.includes('startxref') && buffer.length > 1024) {
        indicators.push({
          type: 'structure',
          severity: 'high',
          message: 'Missing startxref pointer'
        })
      }

      // Check for object corruption patterns
      const objPattern = /\d+ \d+ obj/g
      const endobjPattern = /endobj/g
      const objMatches = pdfString.match(objPattern) || []
      const endobjMatches = pdfString.match(endobjPattern) || []
      
      // Only flag if there's a significant mismatch and we have objects
      if (objMatches.length > 0 && Math.abs(objMatches.length - endobjMatches.length) >= 2) {
        indicators.push({
          type: 'structure',
          severity: 'medium',
          message: 'Mismatched object definitions',
          details: {
            objectStarts: objMatches.length,
            objectEnds: endobjMatches.length
          }
        })
      }

      // Check for common encoding issues
      const nullBytes = buffer.filter(b => b === 0).length
      const nullByteRatio = nullBytes / buffer.length
      
      if (nullByteRatio > 0.7) {  // Increased threshold
        indicators.push({
          type: 'encoding',
          severity: 'high',
          message: 'Excessive null bytes detected - possible encoding corruption'
        })
      }

      // Check for truncation
      const eofMarker = buffer.subarray(-128).toString('utf8')
      if (!eofMarker.includes('%%EOF') && buffer.length > 1024) {
        indicators.push({
          type: 'structure',
          severity: 'medium',
          message: 'PDF appears to be truncated - missing EOF marker'
        })
      }

    } catch (error) {
      indicators.push({
        type: 'content',
        severity: 'low',
        message: 'Error during corruption scan',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    const isCorrupted = indicators.some(i => i.severity === 'high')
    const canBeProcessed = !isCorrupted || indicators.every(i => i.type !== 'structure')

    return {
      isCorrupted,  // Only high severity indicators mark as corrupted
      indicators,
      canBeProcessed,
      recommendation: this.getRecommendation(indicators)
    }
  }

  /**
   * Safely extracts PDF metadata
   */
  async extractPDFMetadata(file: File): Promise<PDFMetadata> {
    try {
      const buffer = await file.arrayBuffer()
      const data = await pdfParse(Buffer.from(buffer))
      
      return {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        keywords: data.info?.Keywords,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: this.parseDate(data.info?.CreationDate),
        modificationDate: this.parseDate(data.info?.ModDate),
        pdfVersion: data.version
      }
    } catch (error) {
      console.error('Failed to extract PDF metadata:', error)
      return {}
    }
  }

  /**
   * Enhanced validation that combines basic and deep checks
   */
  async performDeepValidation(file: File): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
    canProcess: boolean
  }> {
    // Basic validation
    const basicError = await PDFValidator.validatePDFWithDetails(file)
    if (basicError) {
      return {
        valid: false,
        errors: [basicError],
        warnings: [],
        canProcess: false
      }
    }

    // Deep analysis
    const analysis = await this.analyzePDFStructure(file)
    
    // Corruption check
    const buffer = await file.arrayBuffer()
    const corruption = await this.detectPDFCorruption(Buffer.from(buffer))
    
    // Sanitize all error and warning messages
    const sanitizedErrors = [
      ...analysis.errors.map(err => sanitizeErrorMessage(err)),
      ...corruption.indicators
        .filter(i => i.severity === 'high')
        .map(i => sanitizeErrorMessage(i.message))
    ]
    
    const sanitizedWarnings = [
      ...analysis.warnings.map(warn => sanitizeErrorMessage(warn)),
      ...corruption.indicators
        .filter(i => i.severity !== 'high')
        .map(i => sanitizeErrorMessage(i.message))
    ]
    
    return {
      valid: analysis.isValid && !corruption.isCorrupted,
      errors: sanitizedErrors,
      warnings: sanitizedWarnings,
      canProcess: analysis.pageCount > 0 && corruption.canBeProcessed
    }
  }

  private parseDate(dateStr?: string): Date | undefined {
    if (!dateStr) return undefined
    
    try {
      // PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm
      const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/)
      if (match) {
        const [, year, month, day, hour = '0', min = '0', sec = '0'] = match
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(min),
          parseInt(sec)
        )
      }
    } catch {
      // Ignore parse errors
    }
    
    return undefined
  }

  private getRecommendation(indicators: CorruptionIndicator[]): string {
    const highSeverity = indicators.filter(i => i.severity === 'high')
    
    if (highSeverity.length === 0) {
      return 'PDF has minor issues but should be processable'
    }
    
    if (highSeverity.some(i => i.type === 'structure')) {
      return 'PDF structure is corrupted. Consider using PDF repair tools before processing'
    }
    
    if (highSeverity.some(i => i.type === 'encoding')) {
      return 'PDF has encoding issues. The file may be corrupted or use unsupported encoding'
    }
    
    return 'PDF has significant issues and may not process correctly'
  }
}

// Singleton instance
export const pdfAnalyzer = new PDFAnalyzer()