import { 
  AIModel, 
  AIModelConfig, 
  DocumentAnalysis, 
  EnhancementRequest, 
  AIProviderResponse 
} from './types'

export abstract class BaseAIProvider {
  protected config: AIModelConfig
  protected retryAttempts: number = 3
  protected retryDelay: number = 1000 // ms

  constructor(config: AIModelConfig) {
    this.config = config
  }

  abstract get model(): AIModel

  abstract analyzeDocument(
    imageUrl: string, 
    request: EnhancementRequest
  ): Promise<AIProviderResponse<DocumentAnalysis>>

  abstract generateEnhancementPrompt(
    analysis: DocumentAnalysis,
    request: EnhancementRequest
  ): Promise<AIProviderResponse<string>>

  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error
      }

      const delay = this.retryDelay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      return this.retryWithBackoff(operation, attempt + 1)
    }
  }

  protected calculateCost(tokens: number): number {
    // Base implementation - override in specific providers
    const costPer1kTokens = this.getCostPer1kTokens()
    return (tokens / 1000) * costPer1kTokens
  }

  protected abstract getCostPer1kTokens(): number

  protected buildAnalysisPrompt(request: EnhancementRequest): string {
    const { documentType, preferences } = request
    
    return `Analyze this ${documentType} document and provide a detailed assessment:

1. Layout Analysis:
   - Evaluate the overall structure and organization
   - Identify spacing, alignment, and hierarchy issues
   - Score from 0-100

2. Color Analysis:
   - Assess color palette harmony and contrast
   - Check accessibility (WCAG compliance)
   - Identify the main colors used
   - Score from 0-100

3. Typography Analysis:
   - Evaluate font choices and consistency
   - Check readability and hierarchy
   - Identify all fonts used
   - Score from 0-100

4. Engagement Analysis:
   - Assess visual appeal and interest
   - Evaluate readability score
   - Consider target audience: ${preferences?.targetAudience || 'general'}
   - Score from 0-100

Provide specific issues and actionable suggestions for each category.
Format the response as a JSON object matching the DocumentAnalysis interface.`
  }

  protected buildEnhancementPrompt(
    analysis: DocumentAnalysis,
    request: EnhancementRequest
  ): string {
    const { preferences } = request
    
    return `Based on the following document analysis, generate specific enhancement recommendations:

Analysis Results:
${JSON.stringify(analysis, null, 2)}

Style Preference: ${preferences?.style || 'modern'}
Color Scheme: ${preferences?.colorScheme || 'vibrant'}
Target Audience: ${preferences?.targetAudience || 'general'}

Generate a detailed prompt for enhancing this document that addresses:
1. All identified issues in the analysis
2. Incorporates the user's style preferences
3. Maintains the document's core purpose and content
4. Suggests specific design improvements

The prompt should be suitable for image generation AI models.`
  }

  protected validateApiKey(): void {
    if (!this.config.apiKey) {
      throw new Error(`API key not configured for ${this.model}`)
    }
  }

  protected handleError<T = unknown>(error: unknown): AIProviderResponse<T> {
    console.error(`Error in ${this.model} provider:`, error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}