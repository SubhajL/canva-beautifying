import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy, EnhancementPreferences } from './types'
import { ColorEnhancer } from './enhancers/color-enhancer'
import { TypographyEnhancer } from './enhancers/typography-enhancer'
import { LayoutEnhancer } from './enhancers/layout-enhancer'
import { BackgroundEnhancer } from './enhancers/background-enhancer'
import { DecorativeEnhancer } from './enhancers/decorative-enhancer'

export class StrategyGenerator {
  private enhancers = [
    new ColorEnhancer(),
    new TypographyEnhancer(),
    new LayoutEnhancer(),
    new BackgroundEnhancer(),
    new DecorativeEnhancer()
  ]

  async generateStrategies(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy[]> {
    // Collect all strategies from enhancers
    const allStrategies: EnhancementStrategy[] = []
    
    for (const enhancer of this.enhancers) {
      const strategies = await enhancer.analyze(analysis, preferences)
      allStrategies.push(...strategies)
    }

    // Sort strategies by priority and impact
    const sortedStrategies = this.prioritizeStrategies(allStrategies, analysis)
    
    // Filter strategies based on preferences
    const filteredStrategies = this.filterStrategies(sortedStrategies, preferences)
    
    // Ensure strategies don't conflict
    const compatibleStrategies = this.resolveConflicts(filteredStrategies)
    
    return compatibleStrategies
  }

  private prioritizeStrategies(
    strategies: EnhancementStrategy[],
    analysis: DocumentAnalysis
  ): EnhancementStrategy[] {
    // Calculate priority score for each strategy
    const scoredStrategies = strategies.map(strategy => {
      const priorityScore = this.calculatePriorityScore(strategy, analysis)
      return { strategy, score: priorityScore }
    })

    // Sort by score (highest first)
    scoredStrategies.sort((a, b) => b.score - a.score)

    return scoredStrategies.map(item => item.strategy)
  }

  private calculatePriorityScore(
    strategy: EnhancementStrategy,
    analysis: DocumentAnalysis
  ): number {
    let score = 0
    
    // Base score from impact
    score += strategy.impact
    
    // Priority multiplier
    switch (strategy.priority) {
      case 'high': score *= 1.5; break
      case 'medium': score *= 1.0; break
      case 'low': score *= 0.7; break
    }
    
    // Boost strategies that address major issues
    if (this.addressesCriticalIssue(strategy, analysis)) {
      score *= 1.3
    }
    
    // Consider document score - lower scores need more help
    const documentScore = analysis.overallScore
    if (documentScore < 50) {
      score *= 1.2
    }
    
    return score
  }

  private addressesCriticalIssue(
    strategy: EnhancementStrategy,
    analysis: DocumentAnalysis
  ): boolean {
    const criticalIssues = [
      'Poor contrast',
      'Poor readability',
      'Unclear hierarchy',
      'Insufficient white space'
    ]
    
    // Check if strategy addresses any critical issues
    const allIssues = [
      ...analysis.colors.issues,
      ...analysis.typography.issues,
      ...analysis.layout.issues
    ]
    
    return criticalIssues.some(issue => allIssues.includes(issue))
  }

  private filterStrategies(
    strategies: EnhancementStrategy[],
    preferences?: EnhancementPreferences
  ): EnhancementStrategy[] {
    if (!preferences) return strategies
    
    return strategies.filter(strategy => {
      // Filter based on preserve content preference
      if (preferences.preserveContent && this.modifiesContent(strategy)) {
        return false
      }
      
      // Keep all strategies if auto-approve is on
      if (preferences.autoApprove) {
        return true
      }
      
      // Otherwise, limit to high-impact strategies
      return strategy.impact > 50 || strategy.priority === 'high'
    })
  }

  private modifiesContent(strategy: EnhancementStrategy): boolean {
    // Check if strategy modifies existing content
    const contentModifyingChanges = ['layout', 'typography']
    
    return Object.keys(strategy.changes).some(change => 
      contentModifyingChanges.includes(change)
    )
  }

  private resolveConflicts(strategies: EnhancementStrategy[]): EnhancementStrategy[] {
    const resolved: EnhancementStrategy[] = []
    const appliedChanges = new Set<string>()
    
    for (const strategy of strategies) {
      const changeTypes = Object.keys(strategy.changes)
      const hasConflict = changeTypes.some(type => appliedChanges.has(type))
      
      if (!hasConflict) {
        resolved.push(strategy)
        changeTypes.forEach(type => appliedChanges.add(type))
      } else {
        // If there's a conflict, only add if it has higher impact
        const conflictingStrategy = resolved.find(s => 
          Object.keys(s.changes).some(type => changeTypes.includes(type))
        )
        
        if (conflictingStrategy && strategy.impact > conflictingStrategy.impact) {
          // Replace the conflicting strategy
          const index = resolved.indexOf(conflictingStrategy)
          resolved[index] = strategy
        }
      }
    }
    
    return resolved
  }

  async generateOptimalStrategy(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy> {
    // Generate all possible strategies
    const allStrategies = await this.generateStrategies(analysis, preferences)
    
    // Combine compatible strategies into one optimal strategy
    const combinedStrategy: EnhancementStrategy = {
      id: `optimal-${Date.now()}`,
      name: 'Comprehensive Enhancement',
      description: 'Combined optimal enhancements for maximum improvement',
      priority: 'high',
      impact: this.calculateCombinedImpact(allStrategies),
      changes: {}
    }
    
    // Merge all non-conflicting changes
    for (const strategy of allStrategies.slice(0, 5)) { // Limit to top 5
      Object.assign(combinedStrategy.changes, strategy.changes)
    }
    
    return combinedStrategy
  }

  private calculateCombinedImpact(strategies: EnhancementStrategy[]): number {
    if (strategies.length === 0) return 0
    
    // Calculate weighted average impact
    const totalImpact = strategies.reduce((sum, s) => sum + s.impact, 0)
    const avgImpact = totalImpact / strategies.length
    
    // Apply diminishing returns for multiple strategies
    const diminishingFactor = Math.min(1, 0.7 + (0.3 / strategies.length))
    
    return Math.round(avgImpact * diminishingFactor)
  }
}