'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Search,
  Plus,
  ChevronRight,
  Star
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

interface SupportTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  created_at: string
  updated_at: string
  first_response_at?: string
  resolved_at?: string
  satisfaction_rating?: number
  messages_count: number
  assigned_agent?: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

interface SupportStats {
  total_tickets: number
  open_tickets: number
  avg_response_time: string
  avg_resolution_time: string
  satisfaction_score: number
}

export default function BetaSupportDashboard() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [stats, setStats] = useState<SupportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const router = useRouter()
  const supabase = createClientComponentClient()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch tickets
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          messages_count:support_messages(count),
          assigned_agent:assigned_to(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', user.id)

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data: ticketsData, error: ticketsError } = await query
        .order(sortBy, { ascending: false })

      if (ticketsError) throw ticketsError

      // Fetch stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_user_support_stats', { p_user_id: user.id })

      if (statsError) throw statsError

      setTickets(ticketsData || [])
      setStats(statsData?.[0] || null)
    } catch (error) {
      console.error('Error fetching support data:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, sortBy, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'default'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'resolved': return <CheckCircle className="h-4 w-4" />
      default: return null
    }
  }

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Beta Support Dashboard</h1>
          <p className="text-muted-foreground">Priority support for beta users</p>
        </div>
        <Button onClick={() => router.push('/beta/support/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_tickets}</div>
              <p className="text-xs text-muted-foreground">
                {stats.open_tickets} open
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_response_time}</div>
              <Badge variant="secondary" className="mt-1">Beta SLA: 1 hour</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolution Time</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_resolution_time}</div>
              <p className="text-xs text-muted-foreground">Average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.satisfaction_score}/5</div>
              <div className="flex mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i < Math.floor(stats.satisfaction_score)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Support Tickets</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Newest First</SelectItem>
                  <SelectItem value="updated_at">Recently Updated</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No tickets found
              </p>
            ) : (
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/beta/support/ticket/${ticket.id}`)}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{ticket.subject}</h3>
                      <Badge variant={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline">{ticket.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(ticket.status)}
                        <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                      </div>
                      <span>Created {format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
                      {ticket.messages_count > 0 && (
                        <span>{ticket.messages_count} messages</span>
                      )}
                      {ticket.assigned_agent && (
                        <span>Agent: {ticket.assigned_agent.full_name}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}