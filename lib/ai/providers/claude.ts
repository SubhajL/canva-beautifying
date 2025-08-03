import { BaseAIProvider } from '../base-provider'
import { 
  AIModel, 
  AIModelConfig, 
  DocumentAnalysis, 
  EnhancementRequest, 
  AIProviderResponse 
} from '../types'

export class ClaudeProvider extends BaseAIProvider {
  private baseUrl = 'https://api.anthropic.com/v1'
  private modelVersion: 'claude-3.5-sonnet' | 'claude-4-sonnet'
  
  constructor(config: AIModelConfig, modelVersion: 'claude-3.5-sonnet' | 'claude-4-sonnet' = 'claude-3.5-sonnet') {
    super(config)
    this.modelVersion = modelVersion
  }

  get model(): AIModel {
    return this.modelVersion
  }

  protected getCostPer1kTokens(): number {
    // Claude pricing - using average of input/output costs
    if (this.modelVersion === 'claude-3.5-sonnet') {
      // Average of $0.003 input and $0.015 output
      return 0.009
    } else {
      // Claude 4 Sonnet (hypothetical pricing - adjust when available)
      // Average of $0.005 input and $0.025 output
      return 0.015
    }
  }

  private getDetailedCostPer1kTokens(): { input: number; output: number } {
    // Claude pricing - detailed input/output costs
    if (this.modelVersion === 'claude-3.5-sonnet') {
      return {
        input: 0.003,   // $0.003 per 1k input tokens
        output: 0.015   // $0.015 per 1k output tokens
      }
    } else {
      // Claude 4 Sonnet (hypothetical pricing - adjust when available)
      return {
        input: 0.005,   // $0.005 per 1k input tokens
        output: 0.025   // $0.025 per 1k output tokens
      }
    }
  }

  async analyzeDocument(
    imageUrl: string,
    request: EnhancementRequest
  ): Promise<AIProviderResponse<DocumentAnalysis>> {
    this.validateApiKey()

    try {
      // Fetch image and convert to base64
      const imageBase64 = await this.fetchImageAsBase64(imageUrl)
      const mimeType = await this.getMimeType(imageUrl)

      const response = await this.retryWithBackoff(async () => {
        const res = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.modelVersion === 'claude-3.5-sonnet' 
              ? 'claude-3-5-sonnet-20241022'
              : 'claude-4-sonnet-20250115', // Update when Claude 4 is available
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: this.buildAnalysisPrompt(request) + '\n\nPlease respond with a valid JSON object only.'
                  },
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mimeType,
                      data: imageBase64
                    }
                  }
                ]
              }
            ],
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 2048,
            system: 'You are a professional document design analyzer. Always respond with valid JSON that matches the DocumentAnalysis interface structure.'
          }),
          signal: AbortSignal.timeout(this.config.timeout || 30000)
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error?.message || `HTTP ${res.status}`)
        }

        return res.json()
      })

      const content = response.content?.[0]?.text
      if (!content) {
        throw new Error('No content in response')
      }

      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response')
      }

      const analysis = JSON.parse(jsonMatch[0]) as DocumentAnalysis
      
      // Calculate cost
      const usage = response.usage
      const pricing = this.getDetailedCostPer1kTokens()
      const inputCost = (usage.input_tokens / 1000) * pricing.input
      const outputCost = (usage.output_tokens / 1000) * pricing.output
      const totalCost = inputCost + outputCost

      return {
        success: true,
        data: analysis,
        usage: {
          promptTokens: usage.input_tokens,
          completionTokens: usage.output_tokens,
          totalTokens: usage.input_tokens + usage.output_tokens,
          cost: totalCost
        }
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  async generateEnhancementPrompt(
    analysis: DocumentAnalysis,
    request: EnhancementRequest
  ): Promise<AIProviderResponse<string>> {
    this.validateApiKey()

    try {
      const response = await this.retryWithBackoff(async () => {
        const res = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.modelVersion === 'claude-3.5-sonnet' 
              ? 'claude-3-5-sonnet-20241022'
              : 'claude-4-sonnet-20250115', // Update when Claude 4 is available
            messages: [
              {
                role: 'user',
                content: this.buildEnhancementPrompt(analysis, request)
              }
            ],
            temperature: this.config.temperature || 0.8,
            max_tokens: this.config.maxTokens || 1024,
            system: 'You are an expert in creating detailed prompts for AI image generation that enhance document designs while maintaining their core purpose.'
          }),
          signal: AbortSignal.timeout(this.config.timeout || 30000)
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error?.message || `HTTP ${res.status}`)
        }

        return res.json()
      })

      const content = response.content?.[0]?.text
      if (!content) {
        throw new Error('No content in response')
      }

      // Calculate cost
      const usage = response.usage
      const pricing = this.getDetailedCostPer1kTokens()
      const inputCost = (usage.input_tokens / 1000) * pricing.input
      const outputCost = (usage.output_tokens / 1000) * pricing.output
      const totalCost = inputCost + outputCost

      return {
        success: true,
        data: content,
        usage: {
          promptTokens: usage.input_tokens,
          completionTokens: usage.output_tokens,
          totalTokens: usage.input_tokens + usage.output_tokens,
          cost: totalCost
        }
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  private async fetchImageAsBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return base64
  }

  private async getMimeType(imageUrl: string): Promise<string> {
    const extension = imageUrl.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'png':
        return 'image/png'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'webp':
        return 'image/webp'
      default:
        return 'image/jpeg'
    }
  }
}