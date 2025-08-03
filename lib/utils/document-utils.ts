import { PDFDocument } from 'pdf-lib'

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const pages = pdfDoc.getPages()
    const textContent: string[] = []
    
    // PDF-lib doesn't have text extraction
    // In production, you'd use pdf-parse or similar
    // For now, return placeholder
    for (let i = 0; i < pages.length; i++) {
      textContent.push(`[Page ${i + 1} content]`)
    }
    
    return textContent.join('\n\n')
  } catch (error) {
    console.error('PDF text extraction failed:', error)
    return ''
  }
}

export async function extractTextFromImage(_imageBuffer: Buffer): Promise<string> {
  try {
    // In production, you'd use a proper OCR service
    // For now, using Tesseract.js (you'd need to install it)
    // Return placeholder for development
    return '[Extracted text from image]'
  } catch (error) {
    console.error('Image text extraction failed:', error)
    return ''
  }
}

export function detectDocumentType(text: string, metadata: any): string {
  const lowerText = text.toLowerCase()
  
  // Educational document patterns
  const educationalPatterns = [
    'worksheet', 'exercise', 'lesson', 'quiz', 'test',
    'homework', 'assignment', 'question', 'answer',
    'student', 'teacher', 'grade', 'score'
  ]
  
  // Presentation patterns
  const presentationPatterns = [
    'slide', 'agenda', 'overview', 'conclusion',
    'objectives', 'summary', 'thank you', 'questions'
  ]
  
  // Marketing patterns
  const marketingPatterns = [
    'offer', 'sale', 'discount', 'limited time',
    'buy now', 'special', 'promotion', 'deal',
    'save', 'exclusive', 'new', 'introducing'
  ]
  
  // Count pattern matches
  const educationalCount = educationalPatterns.filter(p => lowerText.includes(p)).length
  const presentationCount = presentationPatterns.filter(p => lowerText.includes(p)).length
  const marketingCount = marketingPatterns.filter(p => lowerText.includes(p)).length
  
  // Determine type based on highest count
  if (educationalCount >= 3) return 'educational'
  if (presentationCount >= 3) return 'presentation'
  if (marketingCount >= 3) return 'marketing'
  
  // Check metadata hints
  if (metadata.pageCount > 10) return 'presentation'
  if (metadata.hasImages && metadata.imageCount > 5) return 'marketing'
  
  return 'document'
}

export function calculateReadabilityScore(text: string): number {
  // Simple readability calculation
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0)
  
  if (sentences.length === 0 || words.length === 0) return 50
  
  // Flesch Reading Ease formula
  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = syllables / words.length
  
  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
  
  return Math.max(0, Math.min(100, Math.round(score)))
}

function countSyllables(word: string): number {
  word = word.toLowerCase()
  const vowels = 'aeiouy'
  let count = 0
  let previousWasVowel = false
  
  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i])
    if (isVowel && !previousWasVowel) {
      count++
    }
    previousWasVowel = isVowel
  }
  
  // Adjust for silent e
  if (word.endsWith('e')) {
    count--
  }
  
  // Ensure at least one syllable
  return Math.max(1, count)
}