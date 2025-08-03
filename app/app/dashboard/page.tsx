'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Icons } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
  id: string
  email: string
  name: string | null
  subscription_tier: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { user: authUser, signOut } = useAuth()
  const { user, loading } = useUser()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!authUser && !loading) {
      router.replace('/login')
    }
  }, [authUser, loading, router])

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!authUser) return

      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, subscription_tier')
        .eq('id', authUser.id)
        .single()

      if (data && !error) {
        setUserProfile(data)
      }
    }

    fetchUserProfile()
  }, [authUser, supabase])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  if (!authUser || !user) {
    return null
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {userProfile?.name || authUser.email}!
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          <Icons.logOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{authUser.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Name</p>
              <p className="text-sm text-muted-foreground">{userProfile?.name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Subscription</p>
              <p className="text-sm text-muted-foreground capitalize">
                {userProfile?.subscription_tier || 'free'} tier
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Your latest enhanced documents</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No documents yet</p>
            <Button className="mt-4" onClick={() => router.push('/app/upload')}>
              <Icons.upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>Your enhancement usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium">Documents Enhanced</p>
              <p className="text-2xl font-bold">0</p>
            </div>
            <div>
              <p className="text-sm font-medium">This Month</p>
              <p className="text-sm text-muted-foreground">0 enhancements</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}