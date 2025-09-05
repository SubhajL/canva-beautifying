/**
 * PDF validation utilities
 */

export class PDFValidator {
  // PDF magic bytes - all valid PDFs start with %PDF-
  private static readonly PDF_HEADER = Buffer.from('%PDF-')
  private static readonly MIN_PDF_SIZE = 100 // Minimum size for a valid PDF in bytes
  
  /**
   * Validates if a file is a valid PDF by checking its header and basic structure
   * @param file - File or ArrayBuffer to validate
   * @returns Promise<boolean> - true if valid PDF
   */
  static async isValidPDF(file: File | ArrayBuffer): Promise<boolean> {
    try {
      let buffer: ArrayBuffer
      
      if (file instanceof File) {
        // Check file extension
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          return false
        }
        
        // Check MIME type
        if (file.type !== 'application/pdf') {
          return false
        }
        
        // Check file size
        if (file.size < this.MIN_PDF_SIZE) {
          return false
        }
        
        // Read the first chunk of the file
        buffer = await file.slice(0, 1024).arrayBuffer()
      } else {
        buffer = file
      }
      
      // Convert to Buffer for comparison
      const bytes = Buffer.from(buffer)
      
      // Check PDF header
      if (!bytes.slice(0, 5).equals(this.PDF_HEADER)) {
        return false
      }
      
      // Check for PDF trailer (basic check)
      // A valid PDF should have %%EOF near the end
      const fullBuffer = file instanceof File 
        ? await file.arrayBuffer() 
        : buffer
      const fullBytes = Buffer.from(fullBuffer)
      const trailer = fullBytes.slice(-1024).toString('utf8')
      
      if (!trailer.includes('%%EOF')) {
        return false
      }
      
      return true
    } catch (error) {
      console.error('PDF validation error:', error)
      return false
    }
  }
  
  /**
   * Gets detailed PDF validation errors
   * @param file - File to validate
   * @returns Promise<string | null> - Error message or null if valid
   */
  static async validatePDFWithDetails(file: File): Promise<string | null> {
    try {
      // Check file extension
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return 'File must have .pdf extension'
      }
      
      // Check MIME type
      if (file.type !== 'application/pdf') {
        return `Invalid file type: ${file.type}. Expected application/pdf`
      }
      
      // Check file size
      if (file.size < this.MIN_PDF_SIZE) {
        return `File too small (${file.size} bytes). Minimum size: ${this.MIN_PDF_SIZE} bytes`
      }
      
      // Check PDF header
      const headerBuffer = await file.slice(0, 1024).arrayBuffer()
      const headerBytes = Buffer.from(headerBuffer)
      
      if (!headerBytes.slice(0, 5).equals(this.PDF_HEADER)) {
        const actualHeader = headerBytes.slice(0, 5).toString('utf8')
        return `Invalid PDF header. Expected "%PDF-", got "${actualHeader}"`
      }
      
      // Check for PDF trailer
      const fullBuffer = await file.arrayBuffer()
      const fullBytes = Buffer.from(fullBuffer)
      const trailer = fullBytes.slice(-1024).toString('utf8')
      
      if (!trailer.includes('%%EOF')) {
        return 'Invalid PDF structure: missing %%EOF trailer'
      }
      
      return null // Valid PDF
    } catch (error) {
      return `PDF validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
  
  /**
   * Quick check if buffer starts with PDF header
   * @param buffer - Buffer to check
   * @returns boolean - true if starts with PDF header
   */
  static isPDFHeader(buffer: Buffer | Uint8Array): boolean {
    if (buffer.length < 5) return false
    const bytes = Buffer.from(buffer)
    return bytes.slice(0, 5).equals(this.PDF_HEADER)
  }
}