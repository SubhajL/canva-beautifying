import { PromptEngineer } from '../prompt-engineering'
import { BackgroundGenerationRequest, DecorativeElementRequest } from '../types'

describe('PromptEngineer', () => {
  let promptEngineer: PromptEngineer

  beforeEach(() => {
    promptEngineer = new PromptEngineer()
  })

  describe('generateBackgroundPrompt', () => {
    it('should generate background prompt with template', () => {
      const request: BackgroundGenerationRequest = {
        documentType: 'worksheet',
        colorPalette: ['#0066cc', '#ff6600'],
        theme: 'space',
        style: 'playful',
        mood: 'fun',
        size: '1792x1024',
        userTier: 'pro',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateBackgroundPrompt(request)

      expect(prompt).toContain('playful')
      expect(prompt).toContain('space')
      expect(prompt).toContain('#0066cc and #ff6600')
      expect(prompt).toContain('fun patterns')
      expect(prompt).toContain('child-friendly')
      expect(prompt).toContain('high resolution')
    })

    it('should handle modern style backgrounds', () => {
      const request: BackgroundGenerationRequest = {
        documentType: 'presentation',
        colorPalette: ['#1a73e8', '#34a853', '#fbbc04'],
        theme: 'tech',
        style: 'modern',
        mood: 'professional',
        size: '1792x1024',
        userTier: 'premium',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateBackgroundPrompt(request)

      expect(prompt).toContain('modern abstract background')
      expect(prompt).toContain('#1a73e8, #34a853, and #fbbc04')
      expect(prompt).toContain('gradient')
      expect(prompt).toContain('geometric shapes')
      expect(prompt).toContain('professional design')
    })

    it('should handle professional style backgrounds', () => {
      const request: BackgroundGenerationRequest = {
        documentType: 'flyer',
        colorPalette: ['#000000', '#ffffff'],
        theme: 'corporate',
        style: 'professional',
        mood: 'serious',
        size: '1024x1024',
        userTier: 'basic',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateBackgroundPrompt(request)

      expect(prompt).toContain('professional')
      expect(prompt).toContain('minimalist')
      expect(prompt).toContain('#000000 and #ffffff')
      expect(prompt).toContain('corporate')
      expect(prompt).toContain('clean and elegant')
    })

    it('should use fallback for unknown styles', () => {
      const request: BackgroundGenerationRequest = {
        documentType: 'poster',
        colorPalette: ['#ff0000'],
        theme: 'abstract',
        style: 'unknown-style' as any,
        mood: 'dynamic',
        size: '1024x1024',
        userTier: 'free',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateBackgroundPrompt(request)

      expect(prompt).toContain('unknown-style background for')
      expect(prompt).toContain('poster')
      expect(prompt).toContain('#ff0000')
      expect(prompt).toContain('abstract')
    })

    it('should handle empty color palette', () => {
      const request: BackgroundGenerationRequest = {
        documentType: 'worksheet',
        colorPalette: [],
        theme: 'nature',
        style: 'modern',
        mood: 'calm',
        size: '1024x1024',
        userTier: 'pro',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateBackgroundPrompt(request)

      expect(prompt).toContain('blue and purple') // Default colors
    })
  })

  describe('generateDecorativeElementPrompt', () => {
    it('should generate icon element prompt', () => {
      const request: DecorativeElementRequest = {
        elementType: 'icon',
        position: 'header',
        transparency: true,
        style: 'minimalist',
        prompt: 'star',
        userTier: 'pro',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateDecorativeElementPrompt(request)

      expect(prompt).toContain('simple minimalist icon')
      expect(prompt).toContain('abstract shape')
      expect(prompt).toContain('vector style')
      expect(prompt).toContain('transparent background')
      expect(prompt).toContain('PNG format')
      expect(prompt).toContain('positioned for header placement')
    })

    it('should generate pattern element prompt', () => {
      const request: DecorativeElementRequest = {
        elementType: 'pattern',
        style: 'geometric',
        prompt: 'hexagon pattern',
        userTier: 'premium',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateDecorativeElementPrompt(request)

      expect(prompt).toContain('seamless')
      expect(prompt).toContain('geometric style')
      expect(prompt).toContain('tileable design')
    })

    it('should generate border element prompt', () => {
      const request: DecorativeElementRequest = {
        elementType: 'border',
        position: 'footer',
        style: 'artistic',
        prompt: 'decorative frame',
        userTier: 'basic',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateDecorativeElementPrompt(request)

      expect(prompt).toContain('decorative artistic border frame')
      expect(prompt).toContain('medium lines')
      expect(prompt).toContain('ornamental design')
      expect(prompt).toContain('transparent center')
      expect(prompt).toContain('positioned for footer placement')
    })

    it('should use fallback for unknown element types', () => {
      const request: DecorativeElementRequest = {
        elementType: 'unknown' as any,
        style: 'modern',
        transparency: true,
        prompt: 'decoration',
        userTier: 'free',
        userId: 'test-user'
      }

      const prompt = promptEngineer.generateDecorativeElementPrompt(request)

      expect(prompt).toContain('modern unknown decorative element')
      expect(prompt).toContain('professional design')
      expect(prompt).toContain('transparent background')
    })
  })

  describe('enhancePromptForModel', () => {
    it('should enhance prompt for Stable Diffusion', () => {
      const basePrompt = 'A beautiful sunset'
      const enhanced = promptEngineer.enhancePromptForModel(basePrompt, 'stable-diffusion-xl')

      expect(enhanced).toContain(basePrompt)
      expect(enhanced).toContain('masterpiece')
      expect(enhanced).toContain('best quality')
      expect(enhanced).toContain('highly detailed')
      expect(enhanced).toContain('sharp focus')
      expect(enhanced).toContain('professional')
    })

    it('should enhance prompt for DALL-E 3', () => {
      const basePrompt = 'A futuristic city'
      const enhanced = promptEngineer.enhancePromptForModel(basePrompt, 'dall-e-3')

      expect(enhanced).toContain('Create')
      expect(enhanced).toContain(basePrompt)
      expect(enhanced).toContain('Ensure high quality')
      expect(enhanced).toContain('professional appearance')
    })
  })

  describe('generateNegativePrompt', () => {
    it('should generate base negative prompt', () => {
      const negative = promptEngineer.generateNegativePrompt()

      expect(negative).toContain('blurry')
      expect(negative).toContain('low quality')
      expect(negative).toContain('pixelated')
      expect(negative).toContain('watermark')
      expect(negative).toContain('text')
      expect(negative).toContain('logo')
    })

    it('should add style-specific negatives', () => {
      const styleTests = [
        { 
          style: 'realistic' as any, 
          shouldContain: ['cartoon', 'anime', 'illustration']
        },
        { 
          style: 'artistic' as any, 
          shouldContain: ['photorealistic', 'photography']
        },
        { 
          style: 'cartoon' as any, 
          shouldContain: ['realistic', 'photographic', 'serious']
        },
        { 
          style: 'minimalist' as any, 
          shouldContain: ['complex', 'busy', 'cluttered']
        },
        { 
          style: 'professional' as any, 
          shouldContain: ['casual', 'playful', 'unprofessional']
        }
      ]

      for (const test of styleTests) {
        const negative = promptEngineer.generateNegativePrompt(test.style)
        
        for (const term of test.shouldContain) {
          expect(negative).toContain(term)
        }
      }
    })
  })

  describe('suggestPromptImprovements', () => {
    it('should suggest improvements for short prompts', () => {
      const suggestions = promptEngineer.suggestPromptImprovements('A cat')

      expect(suggestions).toContain('Add more descriptive details to get better results')
    })

    it('should suggest style descriptors if missing', () => {
      const suggestions = promptEngineer.suggestPromptImprovements('A beautiful landscape with mountains')

      expect(suggestions).toContain('Consider adding style descriptors (modern, vintage, minimalist, etc.)')
    })

    it('should suggest quality modifiers if missing', () => {
      const suggestions = promptEngineer.suggestPromptImprovements('An abstract pattern')

      expect(suggestions).toContain('Add quality modifiers like "high quality" or "professional"')
    })

    it('should suggest color preferences if missing', () => {
      const suggestions = promptEngineer.suggestPromptImprovements('A geometric design')

      expect(suggestions).toContain('Specify color preferences for better results')
    })

    it('should return no suggestions for well-formed prompts', () => {
      const suggestions = promptEngineer.suggestPromptImprovements(
        'A modern, high-quality abstract design with blue and purple color scheme, professional style'
      )

      expect(suggestions).toHaveLength(0)
    })
  })

  describe('private helper methods', () => {
    it('should format colors correctly', () => {
      const testCases = [
        { input: [], expected: 'blue and purple' },
        { input: ['red'], expected: 'red' },
        { input: ['red', 'blue'], expected: 'red and blue' },
        { input: ['red', 'blue', 'green'], expected: 'red, blue, and green' },
        { input: ['red', 'blue', 'green', 'yellow'], expected: 'red, blue, green, and yellow' }
      ]

      for (const test of testCases) {
        const request: BackgroundGenerationRequest = {
          documentType: 'worksheet',
          colorPalette: test.input,
          theme: 'test',
          style: 'modern',
          mood: 'test',
          size: '1024x1024',
          userTier: 'free',
          userId: 'test-user'
        }

        const prompt = promptEngineer.generateBackgroundPrompt(request)
        expect(prompt).toContain(test.expected)
      }
    })

    it('should select appropriate patterns for document types', () => {
      const documentTests = [
        { type: 'worksheet', expectedPattern: 'grid' },
        { type: 'presentation', expectedPattern: 'geometric shapes' },
        { type: 'poster', expectedPattern: 'abstract waves' },
        { type: 'flyer', expectedPattern: 'dynamic lines' },
        { type: 'unknown', expectedPattern: 'geometric' }
      ]

      for (const test of documentTests) {
        const request: BackgroundGenerationRequest = {
          documentType: test.type as any,
          colorPalette: ['#000000'],
          theme: 'test',
          style: 'modern',
          mood: 'test',
          size: '1024x1024',
          userTier: 'free',
          userId: 'test-user'
        }

        const prompt = promptEngineer.generateBackgroundPrompt(request)
        expect(prompt).toContain(test.expectedPattern)
      }
    })
  })
})