import { ImageGenerationProvider, ImageGenerationRequest, GeneratedImage } from '../types'

export abstract class BaseImageProvider implements ImageGenerationProvider {
  protected apiKey: string
  protected fallbackKey?: string
  protected modelName: 'stable-diffusion-xl' | 'dall-e-3'

  constructor(apiKey: string, modelName: 'stable-diffusion-xl' | 'dall-e-3', fallbackKey?: string) {
    this.apiKey = apiKey
    this.modelName = modelName
    this.fallbackKey = fallbackKey
  }

  abstract generate(request: ImageGenerationRequest): Promise<GeneratedImage>
  abstract estimateCost(request: ImageGenerationRequest): number
  
  validatePrompt(prompt: string): boolean {
    // Basic validation
    if (!prompt || prompt.trim().length === 0) return false
    if (prompt.length > 4000) return false
    
    // Check for inappropriate content keywords
    const bannedWords = ['nsfw', 'nude', 'explicit', 'violence', 'gore']
    const lowerPrompt = prompt.toLowerCase()
    
    // Check if any banned word is found in the prompt
    for (const word of bannedWords) {
      if (lowerPrompt.includes(word)) {
        return false
      }
    }
    
    return true
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Basic check - ensure API key exists
      return !!this.apiKey
    } catch {
      return false
    }
  }

  protected sanitizePrompt(prompt: string): string {
    // Remove special characters that might break API calls
    return prompt
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  protected addStyleToPrompt(prompt: string, style?: string): string {
    if (!style) return prompt

    const styleModifiers: Record<string, string> = {
      realistic: 'photorealistic, high detail, professional photography',
      artistic: 'artistic, painted, creative, expressive',
      cartoon: 'cartoon style, animated, colorful, playful',
      watercolor: 'watercolor painting, soft colors, artistic',
      minimalist: 'minimalist, simple, clean, modern design',
      abstract: 'abstract art, geometric shapes, modern',
      professional: 'professional, corporate, clean, business-oriented',
      playful: 'fun, colorful, child-friendly, whimsical'
    }

    const modifier = styleModifiers[style] || ''
    return modifier ? `${prompt}, ${modifier}` : prompt
  }

  protected getSizeMapping(size: string): { width: number; height: number } {
    const sizeMap: Record<string, { width: number; height: number }> = {
      '256x256': { width: 256, height: 256 },
      '512x512': { width: 512, height: 512 },
      '1024x1024': { width: 1024, height: 1024 },
      '1024x1792': { width: 1024, height: 1792 },
      '1792x1024': { width: 1792, height: 1024 }
    }
    
    return sizeMap[size] || sizeMap['1024x1024']
  }
}