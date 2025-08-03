import { AIModel, UserTier } from '../types'
import crypto from 'crypto'

interface ABTestConfig {
  id: string
  name: string
  description: string
  startDate: Date
  endDate?: Date
  targetAudience: {
    userTiers?: UserTier[]
    userPercentage?: number
  }
  variants: {
    control: ModelSelectionStrategy
    test: ModelSelectionStrategy
  }
  metrics: string[]
  active: boolean
}

interface ModelSelectionStrategy {
  name: string
  modelPriority?: AIModel[]
  complexityThresholds?: {
    low: number
    high: number
  }
  costOptimizationEnabled?: boolean
  qualityBias?: number // 0-1, higher = prefer quality over speed
}

export class ABTestManager {
  private static activeTests: Map<string, ABTestConfig> = new Map()

  static {
    // Initialize with some example tests
    this.initializeDefaultTests()
  }

  private static initializeDefaultTests(): void {
    // Example: Test aggressive cost optimization for basic tier
    this.addTest({
      id: 'cost-opt-basic-tier',
      name: 'Aggressive Cost Optimization for Basic Tier',
      description: 'Test if aggressive cost optimization improves retention for basic tier users',
      startDate: new Date(),
      targetAudience: {
        userTiers: ['basic'],
        userPercentage: 50
      },
      variants: {
        control: {
          name: 'standard',
          costOptimizationEnabled: false
        },
        test: {
          name: 'aggressive-cost-opt',
          costOptimizationEnabled: true,
          modelPriority: ['gemini-2.0-flash', 'gpt-4o-mini']
        }
      },
      metrics: ['cost_per_request', 'user_satisfaction', 'completion_rate'],
      active: true
    })

    // Example: Test quality-first approach for premium users
    this.addTest({
      id: 'quality-first-premium',
      name: 'Quality-First Model Selection for Premium',
      description: 'Test if always selecting highest quality models improves premium user satisfaction',
      startDate: new Date(),
      targetAudience: {
        userTiers: ['premium'],
        userPercentage: 30
      },
      variants: {
        control: {
          name: 'balanced',
          qualityBias: 0.5
        },
        test: {
          name: 'quality-first',
          qualityBias: 0.9,
          modelPriority: ['claude-4-sonnet', 'claude-3.5-sonnet']
        }
      },
      metrics: ['user_satisfaction', 'processing_time', 'cost_per_request'],
      active: true
    })
  }

  static addTest(config: ABTestConfig): void {
    this.activeTests.set(config.id, config)
  }

  static getExperimentGroup(userId: string, testId: string): 'control' | 'test' | null {
    const test = this.activeTests.get(testId)
    if (!test || !test.active) return null

    // Check if test has ended
    if (test.endDate && new Date() > test.endDate) {
      test.active = false
      return null
    }

    // Check target audience
    const userTier = this.getUserTier(userId) // This would fetch from DB
    if (test.targetAudience.userTiers && 
        !test.targetAudience.userTiers.includes(userTier)) {
      return null
    }

    // Deterministic assignment based on user ID
    const hash = crypto.createHash('sha256')
      .update(`${userId}-${testId}`)
      .digest('hex')
    
    const hashValue = parseInt(hash.substring(0, 8), 16)
    const threshold = test.targetAudience.userPercentage || 100
    
    if ((hashValue % 100) >= threshold) {
      return null // Not in test
    }

    // 50/50 split between control and test
    return (hashValue % 2) === 0 ? 'control' : 'test'
  }

  static getActiveTestsForUser(userId: string, userTier: UserTier): ABTestConfig[] {
    const activeTests: ABTestConfig[] = []

    this.activeTests.forEach(test => {
      if (!test.active) return

      if (test.targetAudience.userTiers && 
          !test.targetAudience.userTiers.includes(userTier)) {
        return
      }

      const group = this.getExperimentGroup(userId, test.id)
      if (group) {
        activeTests.push(test)
      }
    })

    return activeTests
  }

  static applyTestVariant(
    userId: string,
    testId: string,
    baseStrategy: any
  ): any {
    const group = this.getExperimentGroup(userId, testId)
    if (!group) return baseStrategy

    const test = this.activeTests.get(testId)
    if (!test) return baseStrategy

    const variant = test.variants[group]
    
    // Apply variant modifications
    const modifiedStrategy = { ...baseStrategy }

    if (variant.modelPriority) {
      modifiedStrategy.modelPriority = variant.modelPriority
    }

    if (variant.costOptimizationEnabled !== undefined) {
      modifiedStrategy.costOptimization = variant.costOptimizationEnabled
    }

    if (variant.qualityBias !== undefined) {
      modifiedStrategy.qualityBias = variant.qualityBias
    }

    if (variant.complexityThresholds) {
      modifiedStrategy.complexityThresholds = variant.complexityThresholds
    }

    return modifiedStrategy
  }

  private static getUserTier(_userId: string): UserTier {
    // In production, this would fetch from database
    // For now, return a default
    return 'free'
  }

  static recordTestMetric(
    testId: string,
    userId: string,
    metric: string,
    value: number
  ): void {
    const group = this.getExperimentGroup(userId, testId)
    if (!group) return

    // In production, this would write to analytics database
    console.log(`[A/B Test] ${testId} - ${group} - ${metric}: ${value}`)
  }

  static async getTestResults(_testId: string): Promise<{
    control: Record<string, number>
    test: Record<string, number>
    significance: Record<string, boolean>
  }> {
    // In production, this would query analytics database
    // and calculate statistical significance
    return {
      control: {
        cost_per_request: 0.012,
        user_satisfaction: 0.85,
        completion_rate: 0.92
      },
      test: {
        cost_per_request: 0.008,
        user_satisfaction: 0.83,
        completion_rate: 0.91
      },
      significance: {
        cost_per_request: true,
        user_satisfaction: false,
        completion_rate: false
      }
    }
  }
}