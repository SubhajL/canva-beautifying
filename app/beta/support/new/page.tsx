'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, HelpCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { KnowledgeBase } from '@/components/beta/support/knowledge-base'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function NewTicketPage() {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [_showKB, _setShowKB] = useState(true)
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  const handleSubjectChange = (value: string) => {
    setSubject(value)
    setSearchQuery(value)
  }

  const createTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide both subject and description',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
          status: 'open'
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Your support ticket has been created'
      })

      router.push(`/beta/support/ticket/${data.id}`)
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

  const getCategoryDescription = (cat: string) => {
    switch (cat) {
      case 'general':
        return 'General questions about the platform'
      case 'technical':
        return 'Issues with features, bugs, or errors'
      case 'billing':
        return 'Questions about pricing, payments, or subscriptions'
      case 'feature':
        return 'Suggestions for new features or improvements'
      case 'bug':
        return 'Report a bug or unexpected behavior'
      default:
        return ''
    }
  }

  const getPriorityDescription = (pri: string) => {
    switch (pri) {
      case 'low':
        return 'Can wait - Response within 4 hours'
      case 'medium':
        return 'Normal priority - Response within 2 hours'
      case 'high':
        return 'Important issue - Response within 1 hour'
      case 'urgent':
        return 'Critical issue - Response within 30 minutes'
      default:
        return ''
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/beta/support')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Support Ticket</h1>
          <p className="text-muted-foreground">Get priority support as a beta user</p>
        </div>
      </div>

      {/* Beta User Benefits Alert */}
      <Alert className="mb-6 border-primary">
        <HelpCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Beta User Benefits:</strong> Priority response times • Direct access to support team • 
          Feature request priority • Extended support hours
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Form */}
        <Card>
          <CardHeader>
            <CardTitle>New Support Request</CardTitle>
            <CardDescription>
              Fill out the form below to create a support ticket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                placeholder="Brief description of your issue"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="mt-1">
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
                <p className="text-xs text-muted-foreground mt-1">
                  {getCategoryDescription(category)}
                </p>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {getPriorityDescription(priority)}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide detailed information about your issue..."
                className="mt-1 min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include steps to reproduce, error messages, and any relevant details
              </p>
            </div>

            <Button
              onClick={createTicket}
              disabled={loading || !subject.trim() || !description.trim()}
              className="w-full"
            >
              {loading ? 'Creating...' : 'Create Ticket'}
            </Button>
          </CardContent>
        </Card>

        {/* Knowledge Base */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Before you submit...</CardTitle>
              <CardDescription>
                Check if your question has already been answered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="suggested" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="suggested">Suggested Articles</TabsTrigger>
                  <TabsTrigger value="search">Search All</TabsTrigger>
                </TabsList>
                <TabsContent value="suggested" className="mt-4">
                  <KnowledgeBase
                    searchQuery={searchQuery}
                    embedded={true}
                    onArticleSelect={(article) => {
                      window.open(`/help/article/${article.slug}`, '_blank')
                    }}
                  />
                </TabsContent>
                <TabsContent value="search" className="mt-4">
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search knowledge base..."
                        className="pl-9"
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <KnowledgeBase
                      searchQuery={searchQuery}
                      embedded={true}
                      onArticleSelect={(article) => {
                        window.open(`/help/article/${article.slug}`, '_blank')
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}