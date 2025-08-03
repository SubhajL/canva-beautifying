import { BaseAIProvider } from '../base-provider'
import { 
  AIModel, 
  DocumentAnalysis, 
  EnhancementRequest, 
  AIProviderResponse 
} from '../types'

export class OpenAIProvider extends BaseAIProvider {
  private baseUrl = 'https://api.openai.com/v1'
  
  get model(): AIModel {
    return 'gpt-4o-mini'
  }

  protected getCostPer1kTokens(): number {
    // GPT-4o mini pricing - average of input/output
    // Average of $0.00015 input and $0.0006 output
    return 0.000375
  }

  async analyzeDocument(
    imageUrl: string,
    request: EnhancementRequest
  ): Promise<AIProviderResponse<DocumentAnalysis>> {
    this.validateApiKey()

    try {
      const response = await this.retryWithBackoff(async () => {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a professional document design analyzer. Analyze documents and provide detailed assessments in JSON format.'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: this.buildAnalysisPrompt(request)
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageUrl,
                      detail: 'high'
                    }
                  }
                ]
              }
            ],
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 2048,
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(this.config.timeout || 30000)
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error?.message || `HTTP ${res.status}`)
        }

        return res.json()
      })

      const content = response.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content in response')
      }

      const analysis = JSON.parse(content) as DocumentAnalysis
      
      // Calculate cost
      const usage = response.usage
      const inputCost = (usage.prompt_tokens / 1000) * 0.00015
      const outputCost = (usage.completion_tokens / 1000) * 0.0006
      const totalCost = inputCost + outputCost

      return {
        success: true,
        data: analysis,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
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
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an expert in creating prompts for AI image generation that enhance document designs.'
              },
              {
                role: 'user',
                content: this.buildEnhancementPrompt(analysis, request)
              }
            ],
            temperature: this.config.temperature || 0.8,
            max_tokens: this.config.maxTokens || 1024,
          }),
          signal: AbortSignal.timeout(this.config.timeout || 30000)
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error?.message || `HTTP ${res.status}`)
        }

        return res.json()
      })

      const content = response.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content in response')
      }

      // Calculate cost
      const usage = response.usage
      const inputCost = (usage.prompt_tokens / 1000) * 0.00015
      const outputCost = (usage.completion_tokens / 1000) * 0.0006
      const totalCost = inputCost + outputCost

      return {
        success: true,
        data: content,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost: totalCost
        }
      }
    } catch (error) {
      return this.handleError(error)
    }
  }
}