#!/usr/bin/env tsx

import { ModelSelector } from '../lib/ai/model-selector'
import { DocumentAnalysis } from '../lib/ai/types'

// Test scenarios
const scenarios = [
  {
    name: 'Free user with simple document',
    criteria: {
      userTier: 'free' as const,
      documentComplexity: 'low' as const,
      processingPriority: 'speed' as const,
      documentType: 'worksheet' as const,
      userId: 'test-user-1'
    }
  },
  {
    name: 'Basic user with cost optimization',
    criteria: {
      userTier: 'basic' as const,
      documentComplexity: 'medium' as const,
      costOptimization: true,
      estimatedTokens: 3000,
      documentType: 'presentation' as const,
      userId: 'test-user-2'
    }
  },
  {
    name: 'Pro user with complex marketing material',
    criteria: {
      userTier: 'pro' as const,
      documentComplexity: 'high' as const,
      processingPriority: 'quality' as const,
      documentType: 'marketing' as const,
      userId: 'test-user-3'
    }
  },
  {
    name: 'Premium user with failed models',
    criteria: {
      userTier: 'premium' as const,
      documentComplexity: 'high' as const,
      previousFailures: ['claude-4-sonnet', 'claude-3.5-sonnet'],
      documentType: 'presentation' as const,
      userId: 'test-user-4'
    }
  },
  {
    name: 'A/B test participant',
    criteria: {
      userTier: 'basic' as const,
      documentComplexity: 'medium' as const,
      userId: 'ab-test-user-1' // This user might be in an A/B test
    }
  }
]

// Mock document analysis for complexity testing
const mockAnalyses: Record<string, DocumentAnalysis> = {
  simple: {
    layout: { score: 85, issues: [], suggestions: [] },
    colors: { score: 90, palette: ['#000', '#FFF'], issues: [], suggestions: [] },
    typography: { score: 88, fonts: ['Arial'], issues: [], suggestions: [] },
    engagement: { score: 82, readability: 85, visualAppeal: 79, suggestions: [] },
    overallScore: 86.25,
    priority: 'low'
  },
  medium: {
    layout: { score: 65, issues: ['Spacing issues'], suggestions: ['Improve margins'] },
    colors: { score: 70, palette: ['#000', '#FFF', '#FF0000', '#00FF00'], issues: ['Contrast'], suggestions: [] },
    typography: { score: 60, fonts: ['Arial', 'Times'], issues: ['Multiple fonts'], suggestions: [] },
    engagement: { score: 68, readability: 70, visualAppeal: 66, suggestions: [] },
    overallScore: 65.75,
    priority: 'medium'
  },
  complex: {
    layout: { score: 35, issues: ['Poor structure', 'No hierarchy', 'Bad spacing'], suggestions: ['Redesign layout'] },
    colors: { score: 40, palette: ['#000', '#FFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'], issues: ['Too many colors', 'Poor contrast'], suggestions: ['Simplify palette'] },
    typography: { score: 30, fonts: ['Arial', 'Times', 'Comic Sans', 'Impact', 'Courier'], issues: ['Too many fonts', 'Poor readability'], suggestions: ['Limit fonts'] },
    engagement: { score: 25, readability: 30, visualAppeal: 20, suggestions: ['Complete redesign needed'] },
    overallScore: 32.5,
    priority: 'high'
  }
}

console.log('🤖 Testing Model Selection Logic\n')
console.log('=' .repeat(60))

// Test each scenario
scenarios.forEach(scenario => {
  console.log(`\n📋 Scenario: ${scenario.name}`)
  console.log('-' .repeat(40))
  
  const selectedModel = ModelSelector.selectModel(scenario.criteria)
  console.log(`Selected Model: ${selectedModel}`)
  
  // Test complexity determination if applicable
  if (scenario.criteria.documentComplexity) {
    const analysis = mockAnalyses[
      scenario.criteria.documentComplexity === 'low' ? 'simple' :
      scenario.criteria.documentComplexity === 'medium' ? 'medium' : 'complex'
    ]
    
    const complexity = ModelSelector.determineComplexityWithContext(
      analysis,
      scenario.criteria.documentType || 'worksheet'
    )
    console.log(`Calculated Complexity: ${complexity}`)
  }
  
  // Estimate cost and time
  const estimatedCost = ModelSelector.getCostEstimate(
    selectedModel,
    scenario.criteria.estimatedTokens || 2000
  )
  const estimatedTime = ModelSelector.estimateProcessingTime(
    selectedModel,
    scenario.criteria.documentComplexity || 'medium'
  )
  
  console.log(`Estimated Cost: $${estimatedCost.toFixed(4)}`)
  console.log(`Estimated Time: ${estimatedTime}s`)
  
  // Test processing priority
  const priority = ModelSelector.determineProcessingPriority(
    scenario.criteria.userTier,
    scenario.criteria.documentComplexity || 'medium',
    scenario.criteria.processingPriority
  )
  console.log(`Processing Priority: ${priority}`)
})

// Test performance tracking
console.log('\n\n📊 Performance Tracking Test')
console.log('=' .repeat(60))

// Simulate some model usage
const models = ['gemini-2.0-flash', 'gpt-4o-mini', 'claude-3.5-sonnet'] as const
models.forEach(model => {
  // Simulate multiple requests
  for (let i = 0; i < 5; i++) {
    const success = Math.random() > 0.1 // 90% success rate
    const responseTime = 5000 + Math.random() * 10000 // 5-15 seconds
    const tokens = 1000 + Math.random() * 3000 // 1000-4000 tokens
    
    ModelSelector.updatePerformanceMetrics(model, responseTime, success, tokens)
  }
})

console.log('\nUpdated performance metrics recorded.')

// Test recommendations
console.log('\n\n🎯 Model Recommendations Test')
console.log('=' .repeat(60))

const recentUsage = [
  { model: 'gpt-4o-mini' as const, timestamp: new Date(), success: true },
  { model: 'gpt-4o-mini' as const, timestamp: new Date(), success: true },
  { model: 'claude-3.5-sonnet' as const, timestamp: new Date(), success: false },
  { model: 'gemini-2.0-flash' as const, timestamp: new Date(), success: true },
]

const tiers: Array<'free' | 'basic' | 'pro' | 'premium'> = ['free', 'basic', 'pro', 'premium']
tiers.forEach(tier => {
  const { recommended, reasoning } = ModelSelector.getModelRecommendations(tier, recentUsage)
  console.log(`\nTier: ${tier}`)
  console.log(`Recommended Models: ${recommended.join(', ')}`)
  reasoning.forEach(r => console.log(`  - ${r}`))
})

console.log('\n✅ Model selection testing complete!')