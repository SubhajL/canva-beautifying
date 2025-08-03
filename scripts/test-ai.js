import { aiService, ModelSelector, apiKeyManager } from '../lib/ai/index.js'

async function testAIIntegration() {
  console.log('🤖 Testing AI Integration Framework\n')

  // 1. Check API key configuration
  console.log('1. Checking API Key Configuration:')
  const keyStatus = apiKeyManager.getKeyStatus()
  console.table(keyStatus)

  // 2. Validate configuration
  console.log('\n2. Validating AI Service Configuration:')
  const validation = aiService.validateConfiguration()
  if (validation.valid) {
    console.log('✅ Configuration is valid')
  } else {
    console.log('❌ Configuration issues:')
    validation.issues.forEach(issue => console.log(`   - ${issue}`))
  }

  // 3. Test model selection
  console.log('\n3. Testing Model Selection:')
  const testTiers = ['free', 'basic', 'pro', 'premium']
  
  testTiers.forEach(tier => {
    const selectedModel = ModelSelector.selectModel({
      userTier: tier,
      documentComplexity: 'medium',
      processingPriority: 'balanced'
    })
    console.log(`   ${tier.padEnd(8)} → ${selectedModel}`)
  })

  // 4. Test cost estimation
  console.log('\n4. Testing Cost Estimation:')
  const models = ['gemini-2.0-flash', 'gpt-4o-mini', 'claude-3.5-sonnet', 'claude-4-sonnet']
  
  models.forEach(model => {
    const cost = ModelSelector.getCostEstimate(model, 2000)
    console.log(`   ${model.padEnd(20)} → $${cost.toFixed(4)} (for 2k tokens)`)
  })

  // 5. Test processing time estimation
  console.log('\n5. Testing Processing Time Estimation:')
  const complexities = ['low', 'medium', 'high']
  
  models.forEach(model => {
    const times = complexities.map(complexity => 
      ModelSelector.estimateProcessingTime(model, complexity)
    )
    console.log(`   ${model.padEnd(20)} → ${times.join('s, ')}s (low, med, high)`)
  })

  // 6. Test with sample image (if API keys are configured)
  const hasAnyKey = Object.values(keyStatus).some(status => status.hasKey)
  
  if (hasAnyKey && process.env.TEST_IMAGE_URL) {
    console.log('\n6. Testing Document Analysis:')
    console.log('   Analyzing test image...')
    
    try {
      const result = await aiService.analyzeDocument(
        process.env.TEST_IMAGE_URL,
        {
          documentUrl: process.env.TEST_IMAGE_URL,
          documentType: 'worksheet',
          userTier: 'basic',
          preferences: {
            style: 'modern',
            colorScheme: 'vibrant',
            targetAudience: 'children'
          }
        },
        'test-user-123'
      )

      console.log('\n   Analysis Results:')
      console.log(`   - Model Used: ${result.modelUsed}`)
      console.log(`   - Overall Score: ${result.analysis.overallScore}/100`)
      console.log(`   - Layout Score: ${result.analysis.layout.score}/100`)
      console.log(`   - Color Score: ${result.analysis.colors.score}/100`)
      console.log(`   - Typography Score: ${result.analysis.typography.score}/100`)
      console.log(`   - Engagement Score: ${result.analysis.engagement.score}/100`)
      console.log(`   - Estimated Processing Time: ${result.estimatedProcessingTime}s`)
      console.log(`   - Suggested Enhancements: ${result.suggestedEnhancements.length}`)
      
      result.suggestedEnhancements.forEach((enhancement, i) => {
        console.log(`     ${i + 1}. ${enhancement.type} (${enhancement.priority}): ${enhancement.description}`)
      })
    } catch (error) {
      console.error('   ❌ Analysis failed:', error.message)
    }
  } else {
    console.log('\n6. Skipping Document Analysis Test:')
    console.log('   - No API keys configured or TEST_IMAGE_URL not set')
    console.log('   - Set environment variables to test actual analysis')
  }

  console.log('\n✅ AI Integration Test Complete!')
}

// Run the test
testAIIntegration().catch(console.error)