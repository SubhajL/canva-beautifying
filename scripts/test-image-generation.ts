#!/usr/bin/env tsx

import { ImageGenerationService } from '../lib/image-generation/image-generation-service'
import { AssetGenerationStage } from '../lib/enhancement/pipeline/stages/asset-generation'
import { PipelineContext, EnhancementPlan } from '../lib/enhancement/pipeline/types'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function testImageGeneration() {
  console.log('🎨 Testing Image Generation Service...\n')

  const imageService = new ImageGenerationService()

  // Test 1: Check available models
  console.log('1. Checking available models...')
  try {
    const models = await imageService.getAvailableModels()
    console.log('✅ Available models:')
    models.forEach(model => {
      console.log(`   - ${model.model}: ${model.available ? 'Available' : 'Not Available'} (Est. cost: $${model.estimatedCost})`)
    })
  } catch (error) {
    console.error('❌ Failed to check models:', error)
  }

  // Test 2: Generate a test image (only if API keys are configured)
  console.log('\n2. Testing image generation...')
  
  const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
  const hasReplicate = !!process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN !== 'your_replicate_api_token_here'

  if (!hasOpenAI && !hasReplicate) {
    console.log('⚠️  No image generation API keys configured. Skipping generation test.')
    console.log('   Configure OPENAI_API_KEY or REPLICATE_API_TOKEN to enable image generation.')
  } else {
    try {
      const result = await imageService.generateImage({
        prompt: 'A simple abstract geometric pattern with blue and purple colors, minimalist style',
        size: '512x512',
        style: 'minimalist',
        userTier: 'basic',
        userId: 'test-user'
      })
      console.log('✅ Image generated successfully:')
      console.log(`   - URL: ${result.url}`)
      console.log(`   - Model: ${result.model}`)
      console.log(`   - Cost: $${result.cost}`)
      console.log(`   - Cached: ${result.cached ? 'Yes' : 'No'}`)
    } catch (error) {
      console.error('❌ Failed to generate image:', error)
    }
  }

  // Test 3: Test prompt improvements
  console.log('\n3. Testing prompt improvement suggestions...')
  const testPrompts = [
    'A cat',
    'A beautiful landscape',
    'Modern abstract design with blue colors, high quality professional'
  ]

  for (const prompt of testPrompts) {
    const suggestions = imageService.suggestPromptImprovements(prompt)
    console.log(`\n   Prompt: "${prompt}"`)
    if (suggestions.length > 0) {
      console.log('   Suggestions:')
      suggestions.forEach(s => console.log(`     - ${s}`))
    } else {
      console.log('   ✅ No improvements needed!')
    }
  }

  // Test 4: Test asset generation stage
  console.log('\n4. Testing asset generation stage...')
  const assetStage = new AssetGenerationStage()
  
  const context: PipelineContext = {
    userId: 'test-user',
    documentId: 'test-doc',
    subscriptionTier: hasOpenAI || hasReplicate ? 'pro' : 'free',
    enhancementType: 'full',
    uploadedFiles: [],
    outputPath: '/tmp/test'
  }

  const plan: EnhancementPlan = {
    assetRequirements: {
      backgrounds: [
        {
          style: 'gradient',
          theme: 'professional',
          colors: ['#0066cc', '#004499'],
          opacity: 0.9
        }
      ],
      decorativeElements: [
        {
          type: 'shape',
          placement: 'corners',
          quantity: 2,
          style: 'minimalist'
        }
      ],
      educationalGraphics: []
    },
    colorEnhancements: {
      primaryColor: '#0066cc',
      secondaryColor: '#004499',
      accentColor: '#ff6600',
      backgroundColor: '#ffffff'
    },
    layoutChanges: [],
    typographyUpdates: []
  }

  try {
    console.log('   Generating assets...')
    const assets = await assetStage.execute(context, plan)
    console.log('✅ Assets generated:')
    console.log(`   - Backgrounds: ${assets.backgrounds.length}`)
    console.log(`   - Decorative Elements: ${assets.decorativeElements.length}`)
    console.log(`   - Educational Graphics: ${assets.educationalGraphics.length}`)
    console.log(`   - Total Assets: ${assets.totalAssets}`)
    console.log(`   - Storage Used: ${(assets.storageUsed / 1024).toFixed(2)} KB`)
  } catch (error) {
    console.error('❌ Failed to generate assets:', error)
  }

  // Test 5: Test caching behavior
  console.log('\n5. Testing caching...')
  if (hasOpenAI || hasReplicate) {
    try {
      const cachePrompt = 'A unique test pattern for caching ' + Date.now()
      
      // First generation
      console.log('   Generating new image...')
      const first = await imageService.generateImage({
        prompt: cachePrompt,
        size: '256x256',
        userTier: 'basic',
        userId: 'cache-test'
      })
      console.log(`   ✅ First generation cost: $${first.cost}`)
      
      // Second generation (should be cached)
      console.log('   Requesting same image again...')
      const second = await imageService.generateImage({
        prompt: cachePrompt,
        size: '256x256',
        userTier: 'basic',
        userId: 'cache-test'
      })
      console.log(`   ✅ Second generation cost: $${second.cost} (Cached: ${second.cached ? 'Yes' : 'No'})`)
      
      if (second.cached && second.cost === 0) {
        console.log('   ✅ Caching working correctly!')
      }
    } catch (error) {
      console.error('❌ Failed caching test:', error)
    }
  } else {
    console.log('   ⚠️  Skipping cache test (no API keys configured)')
  }

  // Test 6: Cost tracking
  console.log('\n6. Testing cost tracking...')
  try {
    const totalCost = await imageService.getUserCost('test-user')
    console.log(`✅ Total cost for test-user: $${totalCost.toFixed(4)}`)
  } catch (error) {
    console.error('❌ Failed to get user cost:', error)
  }

  console.log('\n✨ Image generation tests complete!')
}

// Run tests
testImageGeneration().catch(console.error)