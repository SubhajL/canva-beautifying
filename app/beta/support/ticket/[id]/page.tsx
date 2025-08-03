'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft,
  Send,
  Paperclip,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  User,
  Bot
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

interface TicketDetails {
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
  sla_deadline: string
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
  messages: {
    id: string
    message: string
    sender_id: string
    sender_type: 'user' | 'agent'
    created_at: string
    sender: {
      full_name: string
      avatar_url?: string
    }
  }[]
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<TicketDetails | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [rating, setRating] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchTicket = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
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
          ),
          messages:support_messages(
            id,
            message,
            sender_id,
            sender_type,
            created_at,
            sender:sender_id(
              user_metadata->full_name,
              user_metadata->avatar_url
            )
          )
        `)
        .eq('id', params.id)
        .single()

      if (error) throw error

      // Verify user owns this ticket
      if (data.user_id !== user.id) {
        router.push('/beta/support')
        return
      }

      setTicket(data)
    } catch (error) {
      console.error('Error fetching ticket:', error)
      toast({
        title: 'Error',
        description: 'Failed to load ticket details',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [params.id, router, supabase, toast])

  useEffect(() => {
    fetchTicket()
    
    // Set up real-time subscription
    const subscription = supabase
      .channel(`ticket:${params.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'support_messages',
          filter: `ticket_id=eq.${params.id}`
        }, 
        () => fetchTicket()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [params.id, fetchTicket, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [ticket?.messages])

  const sendMessage = async () => {
    if (!message.trim() || !ticket) return

    try {
      setSending(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          message: message.trim(),
          sender_id: user.id,
          sender_type: 'user'
        })

      if (error) throw error

      setMessage('')
      fetchTicket()
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      })
    } finally {
      setSending(false)
    }
  }

  const submitRating = async () => {
    if (!rating || !ticket) return

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          satisfaction_rating: parseInt(rating),
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id)

      if (error) throw error

      toast({
        title: 'Thank you!',
        description: 'Your feedback has been recorded'
      })
      fetchTicket()
    } catch (error) {
      console.error('Error submitting rating:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit rating',
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

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>
  }

  if (!ticket) {
    return <div className="container mx-auto p-6">Ticket not found</div>
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/beta/support')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={getPriorityColor(ticket.priority)}>
              {ticket.priority}
            </Badge>
            <Badge variant="outline">{ticket.category}</Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {getStatusIcon(ticket.status)}
              <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
        {ticket.status === 'resolved' && !ticket.satisfaction_rating && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Star className="mr-2 h-4 w-4" />
                Rate Support
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>How was your support experience?</DialogTitle>
                <DialogDescription>
                  Your feedback helps us improve our service
                </DialogDescription>
              </DialogHeader>
              <RadioGroup value={rating} onValueChange={setRating} className="space-y-2 my-4">
                {[5, 4, 3, 2, 1].map((value) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value.toString()} id={`rating-${value}`} />
                    <Label htmlFor={`rating-${value}`} className="flex items-center gap-1 cursor-pointer">
                      {[...Array(value)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">
                        {value === 5 && 'Excellent'}
                        {value === 4 && 'Good'}
                        {value === 3 && 'Average'}
                        {value === 2 && 'Poor'}
                        {value === 1 && 'Very Poor'}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Button onClick={submitRating} disabled={!rating}>
                Submit Rating
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-4 pb-4">
                  {/* Initial ticket message */}
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={''} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">You</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ticket.created_at))} ago
                        </span>
                      </div>
                      <div className="bg-muted rounded-lg p-3 mt-1">
                        <p className="whitespace-pre-wrap">{ticket.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  {ticket.messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        {msg.sender_type === 'agent' ? (
                          <>
                            <AvatarImage src={msg.sender.avatar_url} />
                            <AvatarFallback>
                              <Bot className="h-4 w-4" />
                            </AvatarFallback>
                          </>
                        ) : (
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {msg.sender_type === 'agent' ? msg.sender.full_name : 'You'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(msg.created_at))} ago
                          </span>
                        </div>
                        <div className={`rounded-lg p-3 mt-1 ${
                          msg.sender_type === 'agent' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {ticket.status !== 'closed' && (
                <>
                  <Separator />
                  <div className="p-4 flex gap-2">
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="resize-none"
                      rows={2}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                    />
                    <div className="flex flex-col gap-2">
                      <Button size="icon" variant="outline">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        onClick={sendMessage}
                        disabled={!message.trim() || sending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Ticket Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              {ticket.first_response_at && (
                <div>
                  <p className="text-sm text-muted-foreground">First Response</p>
                  <p className="text-sm font-medium">
                    {formatDistanceToNow(new Date(ticket.first_response_at))} after creation
                  </p>
                </div>
              )}
              {ticket.resolved_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-sm font-medium">
                    {format(new Date(ticket.resolved_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
              {ticket.sla_deadline && (
                <div>
                  <p className="text-sm text-muted-foreground">SLA Deadline</p>
                  <p className="text-sm font-medium">
                    {format(new Date(ticket.sla_deadline), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Agent */}
          {ticket.assigned_agent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Support Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={ticket.assigned_agent.avatar_url} />
                    <AvatarFallback>
                      {ticket.assigned_agent.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{ticket.assigned_agent.full_name}</p>
                    <p className="text-sm text-muted-foreground">Support Specialist</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rating */}
          {ticket.satisfaction_rating && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < ticket.satisfaction_rating!
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {ticket.satisfaction_rating}/5
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}