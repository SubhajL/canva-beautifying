import { DocumentAnalysis } from '@/lib/ai/types'
import { AnalysisSnapshot, ImprovementMetrics } from './types'
import sharp from 'sharp'

export class ComparisonGenerator {
  async generateComparison(
    beforeAnalysis: DocumentAnalysis,
    afterAnalysis: DocumentAnalysis,
    beforeUrl?: string,
    afterUrl?: string
  ): Promise<{
    before: AnalysisSnapshot
    after: AnalysisSnapshot
    improvements: ImprovementMetrics
  }> {
    // Generate snapshots
    const beforeSnapshot = await this.createSnapshot(beforeAnalysis, beforeUrl)
    const afterSnapshot = await this.createSnapshot(afterAnalysis, afterUrl)
    
    // Calculate improvements
    const improvements = this.calculateImprovements(beforeSnapshot, afterSnapshot)
    
    return {
      before: beforeSnapshot,
      after: afterSnapshot,
      improvements
    }
  }

  private async createSnapshot(
    analysis: DocumentAnalysis,
    imageUrl?: string
  ): Promise<AnalysisSnapshot> {
    let screenshot: string | undefined
    
    if (imageUrl) {
      screenshot = await this.generateThumbnail(imageUrl)
    }
    
    return {
      overallScore: analysis.overallScore,
      visualAppeal: analysis.engagement.visualAppeal,
      readability: analysis.typography.readabilityScore,
      engagement: analysis.engagement.score,
      colorHarmony: analysis.colors.harmony,
      layoutScore: analysis.layout.score,
      typographyScore: analysis.typography.score,
      screenshot
    }
  }

  private calculateImprovements(
    before: AnalysisSnapshot,
    after: AnalysisSnapshot
  ): ImprovementMetrics {
    const calculateGain = (beforeVal: number, afterVal: number): number => {
      return afterVal - beforeVal
    }
    
    const calculatePercentage = (beforeVal: number, afterVal: number): number => {
      if (beforeVal === 0) return 100
      return Math.round(((afterVal - beforeVal) / beforeVal) * 100)
    }
    
    const metrics: ImprovementMetrics = {
      overallImprovement: calculateGain(before.overallScore, after.overallScore),
      visualAppealGain: calculateGain(before.visualAppeal, after.visualAppeal),
      readabilityGain: calculateGain(before.readability, after.readability),
      engagementGain: calculateGain(before.engagement, after.engagement),
      colorHarmonyGain: calculateGain(before.colorHarmony, after.colorHarmony),
      layoutImprovement: calculateGain(before.layoutScore, after.layoutScore),
      typographyImprovement: calculateGain(before.typographyScore, after.typographyScore),
      percentageGains: {
        overall: calculatePercentage(before.overallScore, after.overallScore),
        visualAppeal: calculatePercentage(before.visualAppeal, after.visualAppeal),
        readability: calculatePercentage(before.readability, after.readability),
        engagement: calculatePercentage(before.engagement, after.engagement),
        colorHarmony: calculatePercentage(before.colorHarmony, after.colorHarmony),
        layout: calculatePercentage(before.layoutScore, after.layoutScore),
        typography: calculatePercentage(before.typographyScore, after.typographyScore)
      }
    }
    
    return metrics
  }

  private async generateThumbnail(imageUrl: string): Promise<string> {
    try {
      // Download image
      const response = await fetch(imageUrl)
      const buffer = await response.arrayBuffer()
      
      // Generate thumbnail
      const thumbnail = await sharp(Buffer.from(buffer))
        .resize(400, 300, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 80 })
        .toBuffer()
      
      // Convert to base64
      return `data:image/jpeg;base64,${thumbnail.toString('base64')}`
    } catch (error) {
      console.error('Failed to generate thumbnail:', error)
      return ''
    }
  }

  generateComparisonVisual(
    before: AnalysisSnapshot,
    after: AnalysisSnapshot
  ): string {
    // Generate SVG visualization of score improvements
    const categories = [
      { name: 'Overall', before: before.overallScore, after: after.overallScore },
      { name: 'Visual Appeal', before: before.visualAppeal, after: after.visualAppeal },
      { name: 'Readability', before: before.readability, after: after.readability },
      { name: 'Engagement', before: before.engagement, after: after.engagement },
      { name: 'Color Harmony', before: before.colorHarmony, after: after.colorHarmony },
      { name: 'Layout', before: before.layoutScore, after: after.layoutScore },
      { name: 'Typography', before: before.typographyScore, after: after.typographyScore }
    ]
    
    const width = 600
    const height = 400
    const margin = { top: 20, right: 30, bottom: 40, left: 50 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom
    const barWidth = chartWidth / categories.length / 3
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
    svg += `<rect width="${width}" height="${height}" fill="white"/>`
    
    // Add title
    svg += `<text x="${width/2}" y="${margin.top}" text-anchor="middle" font-size="16" font-weight="bold">Score Improvements</text>`
    
    // Add axes
    svg += `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="black"/>`
    svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="black"/>`
    
    // Add bars
    categories.forEach((cat, i) => {
      const x = margin.left + (i * chartWidth / categories.length) + 10
      const beforeHeight = (cat.before / 100) * chartHeight
      const afterHeight = (cat.after / 100) * chartHeight
      const y1 = height - margin.bottom - beforeHeight
      const y2 = height - margin.bottom - afterHeight
      
      // Before bar
      svg += `<rect x="${x}" y="${y1}" width="${barWidth}" height="${beforeHeight}" fill="#94a3b8" opacity="0.7"/>`
      
      // After bar
      svg += `<rect x="${x + barWidth + 5}" y="${y2}" width="${barWidth}" height="${afterHeight}" fill="#3b82f6" opacity="0.7"/>`
      
      // Label
      svg += `<text x="${x + barWidth}" y="${height - 10}" text-anchor="middle" font-size="10">${cat.name}</text>`
      
      // Value labels
      svg += `<text x="${x + barWidth/2}" y="${y1 - 5}" text-anchor="middle" font-size="10">${cat.before}</text>`
      svg += `<text x="${x + barWidth*1.5 + 5}" y="${y2 - 5}" text-anchor="middle" font-size="10">${cat.after}</text>`
    })
    
    // Add legend
    svg += `<rect x="${width - 100}" y="${margin.top + 10}" width="${15}" height="${15}" fill="#94a3b8" opacity="0.7"/>`
    svg += `<text x="${width - 80}" y="${margin.top + 22}" font-size="12">Before</text>`
    svg += `<rect x="${width - 100}" y="${margin.top + 30}" width="${15}" height="${15}" fill="#3b82f6" opacity="0.7"/>`
    svg += `<text x="${width - 80}" y="${margin.top + 42}" font-size="12">After</text>`
    
    svg += '</svg>'
    
    return svg
  }
}