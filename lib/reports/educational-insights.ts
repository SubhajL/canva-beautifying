import { EducationalInsight } from './types'
import { AppliedEnhancement } from './types'

export class EducationalInsightsGenerator {
  private insights: Map<string, EducationalInsight[]> = new Map()

  constructor() {
    this.initializeInsights()
  }

  private initializeInsights() {
    // Color insights
    this.insights.set('color', [
      {
        id: 'color-harmony',
        category: 'color',
        title: 'Color Harmony Principles',
        description: 'Understanding how colors work together creates visually pleasing designs',
        tip: 'Use complementary colors (opposite on color wheel) for high contrast, or analogous colors (adjacent) for harmony',
        difficulty: 'beginner',
        resources: [
          {
            title: 'Color Theory Basics',
            url: 'https://www.interaction-design.org/literature/topics/color-theory',
            type: 'article'
          }
        ]
      },
      {
        id: 'color-psychology',
        category: 'color',
        title: 'Color Psychology in Design',
        description: 'Colors evoke emotions and influence viewer behavior',
        tip: 'Blue conveys trust and professionalism, while orange creates energy and urgency',
        difficulty: 'intermediate',
        resources: [
          {
            title: 'The Psychology of Color',
            url: 'https://www.colorpsychology.org/',
            type: 'article'
          }
        ]
      },
      {
        id: 'color-accessibility',
        category: 'color',
        title: 'Color Contrast for Accessibility',
        description: 'Ensure your content is readable for all users, including those with visual impairments',
        tip: 'Maintain a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text',
        difficulty: 'intermediate'
      }
    ])

    // Typography insights
    this.insights.set('typography', [
      {
        id: 'font-pairing',
        category: 'typography',
        title: 'Font Pairing Fundamentals',
        description: 'Combining fonts effectively creates visual hierarchy and interest',
        tip: 'Pair a serif font for headings with a sans-serif for body text, or use different weights of the same font family',
        difficulty: 'beginner',
        resources: [
          {
            title: 'Font Pairing Guide',
            url: 'https://fontpair.co/',
            type: 'article'
          }
        ]
      },
      {
        id: 'typography-hierarchy',
        category: 'typography',
        title: 'Creating Typography Hierarchy',
        description: 'Guide readers through your content with clear visual hierarchy',
        tip: 'Use size, weight, and spacing to create 3-4 distinct levels of hierarchy',
        difficulty: 'intermediate'
      },
      {
        id: 'readability',
        category: 'typography',
        title: 'Optimizing for Readability',
        description: 'Make your text easy to read and understand',
        tip: 'Set line height to 1.5-1.7x font size and limit line length to 50-75 characters',
        difficulty: 'beginner'
      }
    ])

    // Layout insights
    this.insights.set('layout', [
      {
        id: 'grid-systems',
        category: 'layout',
        title: 'Grid Systems in Design',
        description: 'Grids provide structure and consistency to your layouts',
        tip: 'Start with a 12-column grid for flexibility, or use the rule of thirds for simple layouts',
        difficulty: 'intermediate',
        resources: [
          {
            title: 'Grid Systems in Graphic Design',
            url: 'https://www.smashingmagazine.com/2017/12/building-better-ui-designs-layout-grids/',
            type: 'article'
          }
        ]
      },
      {
        id: 'white-space',
        category: 'layout',
        title: 'The Power of White Space',
        description: 'Empty space is not wasted space—it helps content breathe',
        tip: 'Use generous margins and padding to reduce cognitive load and improve focus',
        difficulty: 'beginner'
      },
      {
        id: 'visual-flow',
        category: 'layout',
        title: 'Creating Visual Flow',
        description: 'Guide the eye through your design in a logical sequence',
        tip: 'Use the F-pattern for text-heavy content or Z-pattern for visual designs',
        difficulty: 'advanced'
      }
    ])

    // Background insights
    this.insights.set('background', [
      {
        id: 'background-purpose',
        category: 'background',
        title: 'Background Design Purpose',
        description: 'Backgrounds should enhance, not distract from your content',
        tip: 'Keep backgrounds subtle with low contrast patterns or gradients that complement your color scheme',
        difficulty: 'beginner'
      },
      {
        id: 'texture-depth',
        category: 'background',
        title: 'Adding Texture and Depth',
        description: 'Subtle textures can add visual interest without overwhelming',
        tip: 'Use opacity controls to ensure background elements stay in the background',
        difficulty: 'intermediate'
      }
    ])

    // General design insights
    this.insights.set('general', [
      {
        id: 'consistency',
        category: 'general',
        title: 'Consistency is Key',
        description: 'Maintaining consistent design elements builds trust and professionalism',
        tip: 'Create a style guide with your colors, fonts, and spacing rules',
        difficulty: 'beginner'
      },
      {
        id: 'audience-first',
        category: 'general',
        title: 'Design for Your Audience',
        description: 'Always consider who will be viewing your document',
        tip: 'Research your target audience preferences and design accordingly',
        difficulty: 'intermediate'
      },
      {
        id: 'less-is-more',
        category: 'general',
        title: 'The Principle of Simplicity',
        description: 'Simple designs are often the most effective',
        tip: 'Remove any element that doesn\'t serve a clear purpose',
        difficulty: 'advanced'
      }
    ])
  }

  generateInsights(
    appliedEnhancements: AppliedEnhancement[],
    targetAudience: string
  ): EducationalInsight[] {
    const relevantInsights: EducationalInsight[] = []
    const categories = new Set<string>()

    // Collect categories from applied enhancements
    appliedEnhancements.forEach(enhancement => {
      categories.add(enhancement.category)
    })

    // Get insights for each category
    categories.forEach(category => {
      const categoryInsights = this.insights.get(category) || []
      
      // Select most relevant insights
      const selected = this.selectRelevantInsights(
        categoryInsights,
        appliedEnhancements.filter(e => e.category === category),
        targetAudience
      )
      
      relevantInsights.push(...selected)
    })

    // Add general insights
    const generalInsights = this.insights.get('general') || []
    relevantInsights.push(...this.selectGeneralInsights(generalInsights, targetAudience))

    // Limit to reasonable number
    return relevantInsights.slice(0, 8)
  }

  private selectRelevantInsights(
    insights: EducationalInsight[],
    enhancements: AppliedEnhancement[],
    targetAudience: string
  ): EducationalInsight[] {
    // Score insights based on relevance
    const scored = insights.map(insight => {
      let score = 0
      
      // Match difficulty to audience
      if (targetAudience.includes('professional') && insight.difficulty === 'advanced') {
        score += 2
      } else if (targetAudience.includes('student') && insight.difficulty === 'beginner') {
        score += 2
      } else {
        score += 1
      }
      
      // Prefer insights with resources
      if (insight.resources && insight.resources.length > 0) {
        score += 1
      }
      
      // Match to enhancement impact
      const highImpactEnhancements = enhancements.filter(e => e.impact === 'high')
      if (highImpactEnhancements.length > 0) {
        score += 1
      }
      
      return { insight, score }
    })
    
    // Sort by score and take top insights
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(s => ({
        ...s.insight,
        relatedEnhancement: enhancements[0]?.id
      }))
  }

  private selectGeneralInsights(
    insights: EducationalInsight[],
    targetAudience: string
  ): EducationalInsight[] {
    // Select 1-2 general insights based on audience
    if (targetAudience.includes('student') || targetAudience.includes('learner')) {
      return insights.filter(i => i.difficulty === 'beginner').slice(0, 2)
    } else if (targetAudience.includes('professional')) {
      return insights.filter(i => i.difficulty !== 'beginner').slice(0, 1)
    }
    
    return insights.slice(0, 1)
  }

  generateCustomInsight(
    enhancement: AppliedEnhancement,
    improvement: number
  ): EducationalInsight {
    const insights: Record<string, () => EducationalInsight> = {
      color: () => ({
        id: `custom-${enhancement.id}`,
        category: 'color',
        title: 'Your Color Improvements',
        description: `Your document saw a ${improvement}% improvement in color harmony`,
        tip: 'Continue using this color palette in future documents for brand consistency',
        difficulty: 'beginner'
      }),
      typography: () => ({
        id: `custom-${enhancement.id}`,
        category: 'typography',
        title: 'Typography Enhancement Success',
        description: `Readability improved by ${improvement}% with better font choices`,
        tip: 'Save these font pairings as templates for future use',
        difficulty: 'beginner'
      }),
      layout: () => ({
        id: `custom-${enhancement.id}`,
        category: 'layout',
        title: 'Layout Structure Wins',
        description: `Your layout improvements increased visual appeal by ${improvement}%`,
        tip: 'The grid system used here can be applied to all your documents',
        difficulty: 'intermediate'
      }),
      background: () => ({
        id: `custom-${enhancement.id}`,
        category: 'background',
        title: 'Background Enhancement Impact',
        description: 'The new background adds depth without distraction',
        tip: 'Use similar subtle backgrounds to maintain professional appearance',
        difficulty: 'beginner'
      }),
      decorative: () => ({
        id: `custom-${enhancement.id}`,
        category: 'decorative',
        title: 'Decorative Elements Done Right',
        description: 'Strategic decorative elements enhanced visual interest',
        tip: 'Less is more—use decorative elements sparingly for maximum impact',
        difficulty: 'intermediate'
      })
    }
    
    return insights[enhancement.category]?.() || insights.color()
  }
}