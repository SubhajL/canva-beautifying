'use client'

import { useState, useEffect } from 'react'
import { 
  Search,
  Bell,
  BarChart3,
  ChevronDown
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SupportTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  created_at: string
  updated_at: string
  sla_deadline: string
  first_response_at?: string
  user: {
    id: string
    email: string
    full_name?: string
  }
  assigned_agent?: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

interface AgentStats {
  agent_id: string
  agent_name: string
  active_tickets: number
  resolved_today: number
  avg_response_time: string
  satisfaction_rating: number
}

interface DashboardStats {
  total_open_tickets: number
  urgent_tickets: number
  sla_at_risk: number
  avg_wait_time: string
  agents_online: number
  tickets_resolved_today: number
}

export default function AdminSupportDashboard() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [agentStats, setAgentStats] = useState<AgentStats[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [priority, setPriority] = useState('all')
  const [assignedTo, setAssignedTo] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchData()
    // Set up real-time subscription
    const subscription = supabase
      .channel('support_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, 
        () => fetchData()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, priority, assignedTo])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Check if user is an agent
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: agent, error: agentError } = await supabase
        .from('support_agents')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (agentError || !agent) {
        router.push('/unauthorized')
        return
      }

      // Fetch tickets
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          user:user_id(
            id,
            email,
            user_metadata->full_name
          ),
          assigned_agent:assigned_to(
            id,
            full_name,
            avatar_url
          )
        `)

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }
      if (priority !== 'all') {
        query = query.eq('priority', priority)
      }
      if (assignedTo === 'me') {
        query = query.eq('assigned_to', agent.id)
      } else if (assignedTo === 'unassigned') {
        query = query.is('assigned_to', null)
      }

      const { data: ticketsData, error: ticketsError } = await query
        .order('created_at', { ascending: false })

      if (ticketsError) throw ticketsError

      // Fetch dashboard stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_support_dashboard_stats')

      if (statsError) throw statsError

      // Fetch agent stats
      const { data: agentStatsData, error: agentStatsError } = await supabase
        .rpc('get_agent_performance_stats')

      if (agentStatsError) throw agentStatsError

      setTickets(ticketsData || [])
      setStats(statsData?.[0] || null)
      setAgentStats(agentStatsData || [])
    } catch (error) {
      console.error('Error fetching support data:', error)
    } finally {
      setLoading(false)
    }
  }

  const assignTicket = async (ticketId: string, agentId: string | null) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          assigned_to: agentId,
          status: agentId ? 'in_progress' : 'open',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error assigning ticket:', error)
    }
  }

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const updateData: {
        status: string;
        updated_at: string;
        resolved_at?: string;
      } = {
        status,
        updated_at: new Date().toISOString()
      }

      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error updating ticket status:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'default'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'secondary'
    }
  }

  const isSlaDanger = (ticket: SupportTicket) => {
    if (!ticket.sla_deadline || ticket.status === 'resolved' || ticket.status === 'closed') {
      return false
    }
    const deadline = new Date(ticket.sla_deadline)
    const now = new Date()
    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursLeft < 1
  }

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage customer support tickets</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <BarChart3 className="mr-2 h-4 w-4" />
            Reports
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card className="bg-orange-50 dark:bg-orange-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {stats.total_open_tickets}
              </div>
              <p className="text-xs text-muted-foreground">Active cases</p>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.urgent_tickets}
              </div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 dark:bg-yellow-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">SLA Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.sla_at_risk}
              </div>
              <p className="text-xs text-muted-foreground">Near deadline</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_wait_time}</div>
              <p className="text-xs text-muted-foreground">First response</p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Agents Online</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.agents_online}
              </div>
              <p className="text-xs text-muted-foreground">Available now</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.tickets_resolved_today}
              </div>
              <p className="text-xs text-muted-foreground">Cases closed</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-4">
          {/* Filters */}
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
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      <SelectItem value="me">Assigned to Me</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors ${
                      isSlaDanger(ticket) ? 'border-red-500' : ''
                    }`}
                    onClick={() => router.push(`/admin/support/ticket/${ticket.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{ticket.subject}</h3>
                          <Badge variant={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                          <Badge variant="outline">{ticket.category}</Badge>
                          {isSlaDanger(ticket) && (
                            <Badge variant="destructive">SLA Risk</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {ticket.user.email} • Created {formatDistanceToNow(new Date(ticket.created_at))} ago
                        </p>
                        <p className="text-sm line-clamp-2 mt-2">{ticket.description}</p>
                        {ticket.sla_deadline && (
                          <p className="text-xs text-muted-foreground mt-2">
                            SLA: {format(new Date(ticket.sla_deadline), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {ticket.assigned_agent ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={ticket.assigned_agent.avatar_url} />
                              <AvatarFallback>
                                {ticket.assigned_agent.full_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{ticket.assigned_agent.full_name}</span>
                          </div>
                        ) : (
                          <Badge variant="secondary">Unassigned</Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              assignTicket(ticket.id, null)
                            }}>
                              Unassign
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              updateTicketStatus(ticket.id, 'resolved')
                            }}>
                              Mark as Resolved
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              updateTicketStatus(ticket.id, 'closed')
                            }}>
                              Close Ticket
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent Performance Tab */}
        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>Real-time performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agentStats.map((agent) => (
                  <div key={agent.agent_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{agent.agent_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{agent.agent_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {agent.active_tickets} active tickets
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{agent.resolved_today}</p>
                        <p className="text-xs text-muted-foreground">Resolved Today</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{agent.avg_response_time}</p>
                        <p className="text-xs text-muted-foreground">Avg Response</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <p className="text-2xl font-bold">{agent.satisfaction_rating}</p>
                          <span className="text-yellow-500">★</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Satisfaction</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>Manage help articles</CardDescription>
                </div>
                <Button>New Article</Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Knowledge base management coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}