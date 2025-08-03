import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllQueueMetrics } from '@/lib/queue/utils'

export async function GET() {
  try {
    // Check if user is authenticated and is admin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin (you might want to add an admin flag to your users table)
    const { data: userData } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
    
    // For now, only premium users can access queue metrics
    if (userData?.subscription_tier !== 'premium') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Get queue metrics
    const metrics = await getAllQueueMetrics()
    
    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Queue metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue metrics' },
      { status: 500 }
    )
  }
}