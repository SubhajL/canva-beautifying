'use client'

import { EnhancementReport } from '@/lib/reports/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  Lightbulb, 
  Download,
  Share2
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReportViewerProps {
  report: EnhancementReport
  onExport?: () => void
  onShare?: () => void
}

export function ReportViewer({ report, onExport, onShare }: ReportViewerProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{report.documentInfo.name}</h1>
          <p className="text-gray-500 mt-1">
            Enhanced on {new Date(report.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button onClick={onExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          )}
          {onShare && (
            <Button onClick={onShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Share Report
            </Button>
          )}
        </div>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Improvement</CardTitle>
          <CardDescription>Your document has been significantly enhanced</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-5xl font-bold text-primary">
              +{report.comparison.improvements.overallImprovement}%
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{report.engagement.predictedScore}%</p>
              <p className="text-sm text-gray-500">Predicted Engagement</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <Tabs defaultValue="comparison" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="enhancements">Enhancements</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-4">
          <ComparisonView report={report} />
        </TabsContent>

        <TabsContent value="enhancements" className="space-y-4">
          <EnhancementsView report={report} />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <EngagementView report={report} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <InsightsView report={report} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ComparisonView({ report }: { report: EnhancementReport }) {
  const metrics = [
    { 
      name: 'Visual Appeal', 
      before: report.comparison.before.visualAppeal, 
      after: report.comparison.after.visualAppeal 
    },
    { 
      name: 'Readability', 
      before: report.comparison.before.readability, 
      after: report.comparison.after.readability 
    },
    { 
      name: 'Engagement', 
      before: report.comparison.before.engagement, 
      after: report.comparison.after.engagement 
    },
    { 
      name: 'Color Harmony', 
      before: report.comparison.before.colorHarmony, 
      after: report.comparison.after.colorHarmony 
    },
    { 
      name: 'Layout Score', 
      before: report.comparison.before.layoutScore, 
      after: report.comparison.after.layoutScore 
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before & After Comparison</CardTitle>
        <CardDescription>See how each aspect of your document improved</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => {
          const improvement = metric.after - metric.before
          const improvementPercent = Math.round((improvement / metric.before) * 100)
          
          return (
            <div key={metric.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{metric.name}</span>
                <span className="text-green-600">+{improvementPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Progress value={metric.before} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">Before: {metric.before}</p>
                </div>
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <Progress value={metric.after} className="h-2 bg-primary" />
                  <p className="text-xs text-gray-500 mt-1">After: {metric.after}</p>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function EnhancementsView({ report }: { report: EnhancementReport }) {
  const categoryIcons = {
    color: '🎨',
    typography: '✏️',
    layout: '📐',
    background: '🖼️',
    decorative: '✨'
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Enhancement Summary</CardTitle>
          <CardDescription>
            {report.enhancements.totalCount} total enhancements applied
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(report.enhancements.byCategory).map(([category, count]) => (
              <div key={category} className="text-center">
                <div className="text-2xl mb-1">
                  {categoryIcons[category as keyof typeof categoryIcons] || '📋'}
                </div>
                <p className="font-semibold capitalize">{category}</p>
                <p className="text-sm text-gray-500">{count} changes</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applied Enhancements</CardTitle>
          <CardDescription>Detailed list of improvements made</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.enhancements.applied.slice(0, 5).map((enhancement) => (
            <div key={enhancement.id} className="border-l-4 border-primary pl-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">{enhancement.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{enhancement.description}</p>
                </div>
                <Badge variant={
                  enhancement.impact === 'high' ? 'default' : 
                  enhancement.impact === 'medium' ? 'secondary' : 'outline'
                }>
                  {enhancement.impact} impact
                </Badge>
              </div>
              {enhancement.beforeValue && enhancement.afterValue && (
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">Changed from</span>{' '}
                  <span className="font-mono bg-gray-100 px-1 rounded">
                    {typeof enhancement.beforeValue === 'object' 
                      ? JSON.stringify(enhancement.beforeValue)
                      : enhancement.beforeValue}
                  </span>{' '}
                  <span className="text-gray-500">to</span>{' '}
                  <span className="font-mono bg-primary/10 px-1 rounded">
                    {typeof enhancement.afterValue === 'object' 
                      ? JSON.stringify(enhancement.afterValue)
                      : enhancement.afterValue}
                  </span>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function EngagementView({ report }: { report: EnhancementReport }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Engagement Prediction</CardTitle>
          <CardDescription>How your enhanced document will perform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-primary">
              {report.engagement.predictedScore}%
            </div>
            <p className="text-gray-500 mt-2">Predicted Engagement Score</p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Improvement Details</h4>
              <p className="text-sm text-gray-600">
                Improvement: <span className="font-medium">{report.engagement.improvementPercentage}%</span> increase from baseline
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Audience Impact</h4>
              <p className="text-sm text-gray-600">
                Target Audience: <span className="font-medium">{report.engagement.audienceImpact.targetAudience}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Engagement Likelihood:{' '}
                <Badge variant="outline" className="ml-1">
                  {report.engagement.audienceImpact.engagementLikelihood}
                </Badge>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Key Improvements</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {report.engagement.audienceImpact.keyImprovements.map((improvement, index) => (
                  <li key={index}>{improvement}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InsightsView({ report }: { report: EnhancementReport }) {
  return (
    <div className="space-y-4">
      {report.insights.map((insight) => (
        <Card key={insight.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              {insight.title}
            </CardTitle>
            <Badge variant="outline" className="w-fit">
              {insight.difficulty}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-600">{insight.description}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">💡 Pro Tip</p>
              <p className="text-sm text-blue-800 mt-1">{insight.tip}</p>
            </div>
            {insight.resources && insight.resources.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Learn More:</p>
                <ul className="list-disc list-inside text-sm text-blue-600 space-y-1">
                  {insight.resources.map((resource, index) => (
                    <li key={index}>
                      <a 
                        href={resource.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {resource.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}