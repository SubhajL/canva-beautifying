#!/usr/bin/env tsx

import { ImageGenerationServiceStandalone } from '../lib/image-generation/image-generation-service-standalone'
import { PipelineContext, EnhancementPlan } from '../lib/enhancement/pipeline/types'
import { config } from 'dotenv'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Load environment variables
config({ path: '.env.local' })

// Create output directory for test images
const OUTPUT_DIR = join(process.cwd(), 'test-output', 'image-generation')
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function downloadImage(url: string, filename: string): Promise<string> {
  try {
    const response = await fetch(url)
    const buffer = await response.arrayBuffer()
    const outputPath = join(OUTPUT_DIR, filename)
    writeFileSync(outputPath, Buffer.from(buffer))
    return outputPath
  } catch (error) {
    console.error(`Failed to download image: ${error}`)
    return ''
  }
}

async function openImage(path: string) {
  try {
    // Open image with default system viewer
    if (process.platform === 'darwin') {
      await execAsync(`open "${path}"`)
    } else if (process.platform === 'win32') {
      await execAsync(`start "${path}"`)
    } else {
      await execAsync(`xdg-open "${path}"`)
    }
  } catch (error) {
    console.log(`Could not automatically open image. Please check: ${path}`)
  }
}

async function testImageGeneration() {
  console.log('🎨 Testing Image Generation Service (Enhanced)...\n')
  console.log(`📁 Test output directory: ${OUTPUT_DIR}\n`)

  const imageService = new ImageGenerationServiceStandalone()

  // Test 1: Check available models
  console.log('1. Checking available models...')
  try {
    const models = await imageService.getAvailableModels()
    console.log('✅ Available models:')
    models.forEach(model => {
      console.log(`   - ${model.model}: ${model.available ? '✅ Available' : '❌ Not Available'} (Est. cost: $${model.estimatedCost})`)
    })
    
    // Check which keys are missing
    if (!models.find(m => m.model === 'stable-diffusion-xl')?.available) {
      console.log('   ⚠️  Stable Diffusion not available. Add REPLICATE_API_TOKEN to enable.')
    }
    if (!models.find(m => m.model === 'dall-e-3')?.available) {
      console.log('   ⚠️  DALL-E 3 not available. Check OPENAI_API_KEY.')
    }
  } catch (error) {
    console.error('❌ Failed to check models:', error)
  }

  // Test 2: Generate test images
  console.log('\n2. Testing image generation...')
  
  const hasOpenAI = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your_')
  const hasReplicate = process.env.REPLICATE_API_TOKEN && !process.env.REPLICATE_API_TOKEN.includes('your_')

  if (!hasOpenAI && !hasReplicate) {
    console.log('⚠️  No image generation API keys configured. Skipping generation test.')
    console.log('   Configure OPENAI_API_KEY or REPLICATE_API_TOKEN to enable image generation.')
  } else {
    const testImages = [
      {
        name: 'minimalist-pattern',
        prompt: 'A simple abstract geometric pattern with blue and purple colors, minimalist style',
        size: '512x512' as const,
        style: 'minimalist' as const,
        model: undefined // Let system choose
      },
      {
        name: 'educational-bg',
        prompt: 'Professional educational background with subtle math symbols, light blue gradient',
        size: '1024x1024' as const,
        style: 'professional' as const,
        model: hasReplicate ? 'stable-diffusion-xl' as const : undefined
      },
      {
        name: 'playful-icon',
        prompt: 'Colorful star icon with rainbow gradient, playful style, transparent background',
        size: '256x256' as const,
        style: 'playful' as const,
        model: hasOpenAI ? 'dall-e-3' as const : undefined
      }
    ]

    for (const testImage of testImages) {
      try {
        console.log(`\n   Generating ${testImage.name}...`)
        const result = await imageService.generateImage({
          prompt: testImage.prompt,
          size: testImage.size,
          style: testImage.style,
          model: testImage.model,
          userTier: 'pro',
          userId: 'test-user'
        })
        
        console.log(`   ✅ Generated successfully:`)
        console.log(`      - Model: ${result.model}`)
        console.log(`      - Cost: $${result.cost}`)
        console.log(`      - Cached: ${result.cached ? 'Yes' : 'No'}`)
        
        if (result.revisedPrompt) {
          console.log(`      - Revised prompt: ${result.revisedPrompt}`)
        }
        
        // Download and save the image
        const imagePath = await downloadImage(result.url, `${testImage.name}-${Date.now()}.png`)
        if (imagePath) {
          console.log(`      - Saved to: ${imagePath}`)
          await openImage(imagePath)
        }
      } catch (error) {
        console.error(`   ❌ Failed to generate ${testImage.name}:`, error)
      }
    }
  }

  // Test 3: Background generation
  console.log('\n3. Testing background generation...')
  try {
    const bgResult = await imageService.generateBackground({
      documentType: 'worksheet',
      colorPalette: ['#1a73e8', '#34a853'],
      theme: 'educational',
      style: 'modern',
      mood: 'professional',
      size: '1792x1024',
      userTier: 'pro',
      userId: 'test-user'
    })
    
    console.log('✅ Background generated:')
    console.log(`   - Model: ${bgResult.model}`)
    console.log(`   - Cost: $${bgResult.cost}`)
    
    const bgPath = await downloadImage(bgResult.url, `background-${Date.now()}.png`)
    if (bgPath) {
      console.log(`   - Saved to: ${bgPath}`)
      await openImage(bgPath)
    }
  } catch (error) {
    console.error('❌ Failed to generate background:', error)
  }

  // Test 4: Decorative element generation
  console.log('\n4. Testing decorative element generation...')
  try {
    const decorResult = await imageService.generateDecorativeElement({
      elementType: 'pattern',
      position: 'corner',
      transparency: true,
      style: 'geometric',
      prompt: 'hexagon pattern',
      userTier: 'premium',
      userId: 'test-user'
    })
    
    console.log('✅ Decorative element generated:')
    console.log(`   - Model: ${decorResult.model}`)
    console.log(`   - Cost: $${decorResult.cost}`)
    
    const decorPath = await downloadImage(decorResult.url, `decoration-${Date.now()}.png`)
    if (decorPath) {
      console.log(`   - Saved to: ${decorPath}`)
      await openImage(decorPath)
    }
  } catch (error) {
    console.error('❌ Failed to generate decorative element:', error)
  }

  // Test 5: Test caching
  console.log('\n5. Testing caching behavior...')
  if (hasOpenAI || hasReplicate) {
    try {
      const cachePrompt = 'A unique test pattern for caching ' + Math.floor(Date.now() / 10000)
      
      // First generation
      console.log('   Generating new image...')
      const first = await imageService.generateImage({
        prompt: cachePrompt,
        size: '256x256',
        userTier: 'basic',
        userId: 'cache-test'
      })
      console.log(`   ✅ First generation - Model: ${first.model}, Cost: $${first.cost}`)
      
      // Second generation (should be cached)
      console.log('   Requesting same image again...')
      const second = await imageService.generateImage({
        prompt: cachePrompt,
        size: '256x256',
        userTier: 'basic',
        userId: 'cache-test'
      })
      console.log(`   ✅ Second generation - Cost: $${second.cost}, Cached: ${second.cached ? 'Yes' : 'No'}`)
      
      if (second.cached && second.cost === 0) {
        console.log('   ✅ Caching working correctly!')
      } else {
        console.log('   ⚠️  Cache might not be working as expected')
      }
    } catch (error) {
      console.error('❌ Failed caching test:', error)
    }
  }

  // Test 6: Model selection by tier
  console.log('\n6. Testing tier-based model selection...')
  const tierTests = [
    { tier: 'free', expectedModel: 'stable-diffusion-xl' },
    { tier: 'basic', expectedModel: 'stable-diffusion-xl' },
    { tier: 'pro', expectedModel: 'dall-e-3' },
    { tier: 'premium', expectedModel: 'dall-e-3' }
  ]

  for (const test of tierTests) {
    try {
      const result = await imageService.generateImage({
        prompt: 'A simple test image',
        size: '256x256',
        userTier: test.tier as any,
        userId: 'tier-test'
      })
      console.log(`   ${test.tier}: ${result.model} ${result.model === test.expectedModel ? '✅' : '⚠️  (expected ' + test.expectedModel + ')'}`)
    } catch (error) {
      console.log(`   ${test.tier}: ❌ Failed`)
    }
  }

  // Test 7: Cost tracking
  console.log('\n7. Testing cost tracking...')
  try {
    const totalCost = await imageService.getUserCost('test-user')
    console.log(`✅ Total cost for test-user: $${totalCost.toFixed(4)}`)
    
    const cacheCost = await imageService.getUserCost('cache-test')
    console.log(`✅ Total cost for cache-test: $${cacheCost.toFixed(4)}`)
  } catch (error) {
    console.error('❌ Failed to get user cost:', error)
  }

  // Test 8: Error handling
  console.log('\n8. Testing error handling...')
  try {
    await imageService.generateImage({
      prompt: 'nsfw content test - this should fail',
      userId: 'error-test'
    })
    console.log('   ❌ Validation should have failed!')
  } catch (error) {
    console.log('   ✅ Correctly rejected invalid prompt')
  }

  console.log('\n✨ Image generation tests complete!')
  console.log(`\n📁 All generated images saved to: ${OUTPUT_DIR}`)
  console.log('   Images should have opened automatically in your default viewer.')
}

// Run tests
testImageGeneration().catch(console.error)