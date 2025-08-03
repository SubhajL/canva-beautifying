'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'

interface QueueMetrics {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
  completedRate: number
  failureRate: number
  avgProcessingTime: number
}

interface AllQueueMetrics {
  documentAnalysis: QueueMetrics
  enhancement: QueueMetrics
  export: QueueMetrics
  email: QueueMetrics
}

interface UserProfile {
  subscription_tier: 'free' | 'basic' | 'pro' | 'premium';
}

export default function QueueMonitoringPage() {
  const router = useRouter()
  const { user: authUser } = useAuth()
  const [metrics, setMetrics] = useState<AllQueueMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [_userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const supabase = createClient()

  // Check if user has admin access
  useEffect(() => {
    const checkAccess = async () => {
      if (!authUser) {
        router.replace('/login')
        return
      }

      // Fetch user profile to check subscription tier
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', authUser.id)
        .single()

      setUserProfile(profile)

      if (profile && profile.subscription_tier !== 'premium') {
        router.replace('/app/dashboard')
      }
    }

    checkAccess()
  }, [authUser, router, supabase])

  // Fetch queue metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/queues')
      if (!response.ok) {
        throw new Error('Failed to fetch queue metrics')
      }
      const data = await response.json()
      setMetrics(data.metrics)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchMetrics()
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <Icons.spinner className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchMetrics} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!metrics) return null

  const renderQueueCard = (name: string, queue: QueueMetrics) => {
    const total = queue.waiting + queue.active + queue.completed + queue.failed
    const activePercentage = total > 0 ? (queue.active / total) * 100 : 0

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{name}</CardTitle>
          <CardDescription>Queue performance metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Active Jobs</span>
              <span className="font-medium">{queue.active}</span>
            </div>
            <Progress value={activePercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Waiting</p>
              <p className="text-2xl font-bold">{queue.waiting}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{queue.completed}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600">{queue.failed}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Delayed</p>
              <p className="text-2xl font-bold text-yellow-600">{queue.delayed}</p>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span>Failure Rate</span>
              <Badge variant={queue.failureRate > 10 ? 'destructive' : 'secondary'}>
                {queue.failureRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>Avg Processing Time</span>
              <span>{(queue.avgProcessingTime / 1000).toFixed(2)}s</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Queue Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time queue performance and job statistics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Icons.x className="mr-2 h-4 w-4" />
                Stop Auto-refresh
              </>
            ) : (
              <>
                <Icons.refresh className="mr-2 h-4 w-4" />
                Auto-refresh
              </>
            )}
          </Button>
          <Button size="sm" onClick={fetchMetrics}>
            <Icons.refresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Queue Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Active Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {metrics.documentAnalysis.active +
                    metrics.enhancement.active +
                    metrics.export.active +
                    metrics.email.active}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Waiting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {metrics.documentAnalysis.waiting +
                    metrics.enhancement.waiting +
                    metrics.export.waiting +
                    metrics.email.waiting}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Failed (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">
                  {metrics.documentAnalysis.failed +
                    metrics.enhancement.failed +
                    metrics.export.failed +
                    metrics.email.failed}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Overall Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    metrics.documentAnalysis.failureRate > 20 ||
                    metrics.enhancement.failureRate > 20
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="text-lg"
                >
                  {metrics.documentAnalysis.failureRate > 20 ||
                  metrics.enhancement.failureRate > 20
                    ? 'Degraded'
                    : 'Healthy'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {renderQueueCard('Document Analysis', metrics.documentAnalysis)}
            {renderQueueCard('Enhancement', metrics.enhancement)}
            {renderQueueCard('Export', metrics.export)}
            {renderQueueCard('Email', metrics.email)}
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Queue Configuration</CardTitle>
              <CardDescription>
                Current queue settings and limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Document Analysis</h3>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>Concurrency: 5 jobs</p>
                    <p>Rate limit: 10 jobs/minute</p>
                    <p>Retry attempts: 3</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Enhancement</h3>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>Concurrency: 3 jobs</p>
                    <p>Rate limit: 5 jobs/minute</p>
                    <p>Retry attempts: 3</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Export</h3>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>Concurrency: 5 jobs</p>
                    <p>Rate limit: 20 jobs/minute</p>
                    <p>Retry attempts: 3</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Email</h3>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>Concurrency: 10 jobs</p>
                    <p>Rate limit: 100 jobs/minute</p>
                    <p>Retry attempts: 5</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}