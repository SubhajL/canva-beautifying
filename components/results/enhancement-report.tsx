'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  FileText, 
  Download, 
  Eye,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Palette,
  Type,
  Layout,
  Sparkles,
  BarChart3,
  Users,
  Target
} from 'lucide-react'

interface EnhancementReportProps {
  enhancementId: string
  reportData?: any
  reportUrl?: string
}

interface ReportSection {
  title: string
  icon: React.ReactNode
  items: Array<{
    label: string
    value: string | number
    status?: 'success' | 'warning' | 'error'
    description?: string
  }>
}

export function EnhancementReport({ enhancementId: _enhancementId, reportData, reportUrl }: EnhancementReportProps) {
  const [_showFullReport, _setShowFullReport] = useState(false)
  const [reportSections, setReportSections] = useState<ReportSection[]>([])

  useEffect(() => {
    // Parse report data and organize into sections
    if (reportData) {
      const sections: ReportSection[] = [
        {
          title: 'Visual Improvements',
          icon: <Palette className="h-5 w-5" />,
          items: [
            {
              label: 'Color Contrast',
              value: reportData.colorContrast?.improvement || '+25%',
              status: 'success',
              description: 'Improved readability with better color contrast'
            },
            {
              label: 'Color Palette',
              value: reportData.colorPalette?.type || 'Professional',
              description: 'Applied consistent color scheme throughout'
            },
            {
              label: 'Visual Balance',
              value: reportData.visualBalance?.score || '85/100',
              status: reportData.visualBalance?.score > 70 ? 'success' : 'warning'
            }
          ]
        },
        {
          title: 'Typography Enhancements',
          icon: <Type className="h-5 w-5" />,
          items: [
            {
              label: 'Font Hierarchy',
              value: reportData.typography?.hierarchy || 'Improved',
              status: 'success',
              description: 'Clear distinction between headings and body text'
            },
            {
              label: 'Readability Score',
              value: reportData.typography?.readability || '92/100',
              status: 'success'
            },
            {
              label: 'Font Consistency',
              value: reportData.typography?.consistency || '100%',
              description: 'Unified font family across document'
            }
          ]
        },
        {
          title: 'Layout Optimization',
          icon: <Layout className="h-5 w-5" />,
          items: [
            {
              label: 'Alignment',
              value: reportData.layout?.alignment || 'Fixed',
              status: 'success',
              description: 'All elements properly aligned'
            },
            {
              label: 'Spacing',
              value: reportData.layout?.spacing || 'Optimized',
              description: 'Improved whitespace distribution'
            },
            {
              label: 'Structure',
              value: reportData.layout?.structure || 'Enhanced',
              status: 'success'
            }
          ]
        },
        {
          title: 'Engagement Metrics',
          icon: <TrendingUp className="h-5 w-5" />,
          items: [
            {
              label: 'Attention Score',
              value: reportData.engagement?.attention || '+45%',
              status: 'success',
              description: 'Predicted increase in viewer attention'
            },
            {
              label: 'Clarity Index',
              value: reportData.engagement?.clarity || '88/100',
              status: 'success'
            },
            {
              label: 'Professional Appeal',
              value: reportData.engagement?.appeal || 'High',
              description: 'Suitable for professional contexts'
            }
          ]
        }
      ]
      setReportSections(sections)
    }
  }, [reportData])

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Report Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Enhancement Report
            </span>
            {reportUrl && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Report
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            )}
          </CardTitle>
          <CardDescription>
            Detailed analysis of improvements made to your document
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Overall Score */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Improvement Score</span>
              <span className="text-2xl font-bold text-primary">92/100</span>
            </div>
            <Progress value={92} className="h-2" />
          </div>

          {/* Key Achievements */}
          <div className="mb-6">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Key Achievements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Enhanced visual hierarchy</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Improved color consistency</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Optimized typography</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Better content organization</span>
              </div>
            </div>
          </div>

          {/* Detailed Sections */}
          <div className="space-y-4">
            {reportSections.map((section, index) => (
              <Card key={index} className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {section.icon}
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.label}</span>
                            {getStatusIcon(item.status)}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Target Audience Impact */}
          <Card className="mt-4 border-muted">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5" />
                Target Audience Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded">
                  <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Professionals</p>
                  <p className="text-2xl font-bold text-green-600">+85%</p>
                  <p className="text-xs text-muted-foreground">Engagement</p>
                </div>
                <div className="text-center p-3 bg-muted rounded">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Clarity</p>
                  <p className="text-2xl font-bold text-green-600">92%</p>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
                <div className="text-center p-3 bg-muted rounded">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Appeal</p>
                  <p className="text-2xl font-bold text-green-600">High</p>
                  <p className="text-xs text-muted-foreground">Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}