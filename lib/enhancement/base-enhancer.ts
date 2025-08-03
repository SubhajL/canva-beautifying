import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy, EnhancementPreferences } from './types'

export abstract class BaseEnhancer {
  protected readonly name: string
  protected readonly description: string
  protected readonly priority: 'low' | 'medium' | 'high'

  constructor(name: string, description: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    this.name = name
    this.description = description
    this.priority = priority
  }

  abstract analyze(analysis: DocumentAnalysis, preferences?: EnhancementPreferences): Promise<EnhancementStrategy[]>

  protected calculateImpact(currentScore: number, potentialScore: number): number {
    const improvement = potentialScore - currentScore
    return Math.max(0, Math.min(100, improvement))
  }

  protected generateStrategyId(): string {
    return `${this.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
  }

  protected scoreToImpact(score: number): number {
    // Convert a 0-100 score to impact level
    if (score < 50) return 80 // High impact for low scores
    if (score < 70) return 60 // Medium impact for moderate scores
    if (score < 85) return 40 // Low impact for good scores
    return 20 // Minimal impact for excellent scores
  }
}