'use client'

import { useState, useEffect } from 'react'
import { X, MessageCircle, Send, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format } from 'date-fns'

interface SupportTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  created_at: string
  updated_at: string
  messages: SupportMessage[]
  assigned_agent?: {
    id: string
    name: string
    avatar_url?: string
  }
}

interface SupportMessage {
  id: string
  ticket_id: string
  message: string
  sender_id: string
  sender_type: 'user' | 'agent'
  created_at: string
  attachments?: string[]
}

export function BetaSupportWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'new' | 'tickets' | 'chat'>('new')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [loading, setLoading] = useState(false)
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium'
  })
  const [chatMessage, setChatMessage] = useState('')
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (isOpen) {
      fetchTickets()
    }
  }, [isOpen])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          messages:support_messages(*),
          assigned_agent:assigned_to(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
      toast({
        title: 'Error',
        description: 'Failed to load support tickets',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const createTicket = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: _data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: newTicket.subject,
          description: newTicket.description,
          category: newTicket.category,
          priority: newTicket.priority,
          status: 'open'
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Support ticket created successfully'
      })

      setNewTicket({
        subject: '',
        description: '',
        category: 'general',
        priority: 'medium'
      })
      setActiveTab('tickets')
      fetchTickets()
    } catch (error) {
      console.error('Error creating ticket:', error)
      toast({
        title: 'Error',
        description: 'Failed to create support ticket',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!selectedTicket || !chatMessage.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          message: chatMessage,
          sender_id: user.id,
          sender_type: 'user'
        })

      if (error) throw error

      setChatMessage('')
      fetchTickets()
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      })
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'resolved': return <CheckCircle className="h-4 w-4" />
      default: return null
    }
  }

  return (
    <>
      {/* Support Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full h-14 w-14 p-0 shadow-lg"
        variant="default"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Support Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-96 h-[600px] bg-background border rounded-lg shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="font-semibold">Beta Support</h3>
              <p className="text-sm text-muted-foreground">Priority support for beta users</p>
            </div>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 p-1 mx-4 mt-2">
              <TabsTrigger value="new">New Ticket</TabsTrigger>
              <TabsTrigger value="tickets">My Tickets</TabsTrigger>
              <TabsTrigger value="chat">Live Chat</TabsTrigger>
            </TabsList>

            {/* New Ticket Tab */}
            <TabsContent value="new" className="flex-1 p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={newTicket.category}
                  onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="technical">Technical Issue</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={newTicket.priority}
                  onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Provide details about your issue..."
                  className="mt-1 min-h-[150px]"
                />
              </div>

              <Button
                onClick={createTicket}
                disabled={loading || !newTicket.subject || !newTicket.description}
                className="w-full"
              >
                Create Ticket
              </Button>
            </TabsContent>

            {/* Tickets Tab */}
            <TabsContent value="tickets" className="flex-1 p-4">
              <ScrollArea className="h-[450px]">
                {loading ? (
                  <p className="text-center text-muted-foreground">Loading tickets...</p>
                ) : tickets.length === 0 ? (
                  <p className="text-center text-muted-foreground">No tickets yet</p>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        onClick={() => {
                          setSelectedTicket(ticket)
                          setActiveTab('chat')
                        }}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium line-clamp-1">{ticket.subject}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {ticket.description}
                            </p>
                          </div>
                          <Badge variant={getPriorityColor(ticket.priority)} className="ml-2">
                            {ticket.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(ticket.status)}
                            <span className="text-xs capitalize">{ticket.status.replace('_', ' ')}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(ticket.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 flex flex-col p-4">
              {selectedTicket ? (
                <>
                  <div className="border-b pb-2 mb-3">
                    <h4 className="font-medium">{selectedTicket.subject}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getPriorityColor(selectedTicket.priority)} className="text-xs">
                        {selectedTicket.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selectedTicket.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 mb-3">
                    <div className="space-y-3">
                      {selectedTicket.messages?.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.sender_type === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              message.sender_type === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm">{message.message}</p>
                            <span className="text-xs opacity-70 mt-1 block">
                              {format(new Date(message.created_at), 'h:mm a')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type your message..."
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <Button onClick={sendMessage} size="icon" disabled={!chatMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-muted-foreground">Select a ticket to view conversation</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  )
}