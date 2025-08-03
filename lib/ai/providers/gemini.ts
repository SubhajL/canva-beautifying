import { BaseAIProvider } from '../base-provider'
import { 
  AIModel, 
  DocumentAnalysis, 
  EnhancementRequest, 
  AIProviderResponse 
} from '../types'

export class GeminiProvider extends BaseAIProvider {
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
  
  get model(): AIModel {
    return 'gemini-2.0-flash'
  }

  protected getCostPer1kTokens(): number {
    // Gemini 2.0 Flash pricing (approximate)
    return 0.00015 // $0.00015 per 1k tokens
  }

  async analyzeDocument(
    imageUrl: string,
    request: EnhancementRequest
  ): Promise<AIProviderResponse<DocumentAnalysis>> {
    this.validateApiKey()

    try {
      const response = await this.retryWithBackoff(async () => {
        const res = await fetch(
          `${this.baseUrl}/models/gemini-2.0-flash-latest:generateContent?key=${this.config.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    text: this.buildAnalysisPrompt(request)
                  },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: await this.fetchImageAsBase64(imageUrl)
                    }
                  }
                ]
              }],
              generationConfig: {
                temperature: this.config.temperature || 0.7,
                maxOutputTokens: this.config.maxTokens || 2048,
                responseMimeType: "application/json"
              }
            }),
            signal: AbortSignal.timeout(this.config.timeout || 30000)
          }
        )

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error?.message || `HTTP ${res.status}`)
        }

        return res.json()
      })

      const content = response.candidates?.[0]?.content?.parts?.[0]?.text
      if (!content) {
        throw new Error('No content in response')
      }

      const analysis = JSON.parse(content) as DocumentAnalysis
      
      // Calculate token usage (approximate)
      const totalTokens = Math.ceil(content.length / 4) // rough estimate
      const cost = this.calculateCost(totalTokens)

      return {
        success: true,
        data: analysis,
        usage: {
          promptTokens: Math.ceil(totalTokens * 0.3),
          completionTokens: Math.ceil(totalTokens * 0.7),
          totalTokens,
          cost
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
        const res = await fetch(
          `${this.baseUrl}/models/gemini-2.0-flash-latest:generateContent?key=${this.config.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: this.buildEnhancementPrompt(analysis, request)
                }]
              }],
              generationConfig: {
                temperature: this.config.temperature || 0.8,
                maxOutputTokens: this.config.maxTokens || 1024,
              }
            }),
            signal: AbortSignal.timeout(this.config.timeout || 30000)
          }
        )

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error?.message || `HTTP ${res.status}`)
        }

        return res.json()
      })

      const content = response.candidates?.[0]?.content?.parts?.[0]?.text
      if (!content) {
        throw new Error('No content in response')
      }

      // Calculate token usage (approximate)
      const totalTokens = Math.ceil(content.length / 4)
      const cost = this.calculateCost(totalTokens)

      return {
        success: true,
        data: content,
        usage: {
          promptTokens: Math.ceil(totalTokens * 0.3),
          completionTokens: Math.ceil(totalTokens * 0.7),
          totalTokens,
          cost
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
}