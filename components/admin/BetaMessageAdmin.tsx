'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Edit, Trash2, Eye, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loading } from '@/components/ui/loading';

interface BetaMessage {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  target_all_beta: boolean;
  target_user_ids: string[] | null;
  target_tiers: string[] | null;
  publish_at: string;
  expires_at: string | null;
  send_email: boolean;
  email_subject: string | null;
  email_template: string | null;
  created_at: string;
  created_by_user: {
    email: string;
    name: string;
  };
  read_count: { count: number }[];
  interaction_count: { count: number }[];
}

export function BetaMessageAdmin() {
  const { user: _user, session } = useAuth();
  const [messages, setMessages] = useState<BetaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<BetaMessage | null>(null);
  const [_selectedMessage, _setSelectedMessage] = useState<BetaMessage | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    priority: 'medium',
    target_all_beta: true,
    target_tiers: [] as string[],
    publish_at: new Date(),
    expires_at: null as Date | null,
    send_email: false,
    email_subject: '',
    email_template: ''
  });

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/admin/beta/messages', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      } else {
        toast.error('Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        publish_at: formData.publish_at.toISOString(),
        expires_at: formData.expires_at?.toISOString() || null,
        target_tiers: formData.target_all_beta ? null : formData.target_tiers.length > 0 ? formData.target_tiers : null
      };

      const url = editingMessage 
        ? `/api/admin/beta/messages/${editingMessage.id}`
        : '/api/admin/beta/messages';
      
      const method = editingMessage ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(editingMessage ? 'Message updated' : 'Message created');
        setCreateDialogOpen(false);
        setEditingMessage(null);
        resetForm();
        fetchMessages();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save message');
      }
    } catch (error) {
      console.error('Error saving message:', error);
      toast.error('Failed to save message');
    }
  };

  const handleDelete = async (messageId: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      toast.custom((t) => (
        <div className="bg-background p-4 rounded-lg shadow-lg">
          <p className="mb-4">Are you sure you want to delete this message?</p>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast.dismiss(t);
                resolve(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                toast.dismiss(t);
                resolve(true);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      ), { duration: Infinity });
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/beta/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        toast.success('Message deleted');
        fetchMessages();
      } else {
        toast.error('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'general',
      priority: 'medium',
      target_all_beta: true,
      target_tiers: [],
      publish_at: new Date(),
      expires_at: null,
      send_email: false,
      email_subject: '',
      email_template: ''
    });
  };

  const openEditDialog = (message: BetaMessage) => {
    setEditingMessage(message);
    setFormData({
      title: message.title,
      content: message.content,
      category: message.category,
      priority: message.priority,
      target_all_beta: message.target_all_beta,
      target_tiers: message.target_tiers || [],
      publish_at: new Date(message.publish_at),
      expires_at: message.expires_at ? new Date(message.expires_at) : null,
      send_email: message.send_email,
      email_subject: message.email_subject || '',
      email_template: message.email_template || ''
    });
    setCreateDialogOpen(true);
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" text="Loading messages..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Beta Message Management</h2>
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setEditingMessage(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingMessage ? 'Edit Message' : 'Create New Message'}
                </DialogTitle>
                <DialogDescription>
                  Create announcements for beta users
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({...formData, category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="announcement">Announcement</SelectItem>
                        <SelectItem value="feature_update">Feature Update</SelectItem>
                        <SelectItem value="survey">Survey</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="feedback_request">Feedback Request</SelectItem>
                        <SelectItem value="bug_fix">Bug Fix</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({...formData, priority: value})}
                    >
                      <SelectTrigger>
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    rows={5}
                    required
                  />
                </div>

                <div className="space-y-4 border rounded-lg p-4">
                  <h4 className="font-medium">Targeting</h4>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="target_all"
                      checked={formData.target_all_beta}
                      onCheckedChange={(checked) => setFormData({...formData, target_all_beta: checked})}
                    />
                    <Label htmlFor="target_all">Send to all beta users</Label>
                  </div>
                  
                  {!formData.target_all_beta && (
                    <div className="space-y-2">
                      <Label>Target Tiers</Label>
                      <div className="flex flex-wrap gap-2">
                        {['free', 'basic', 'pro', 'premium'].map(tier => (
                          <label key={tier} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.target_tiers.includes(tier)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({...formData, target_tiers: [...formData.target_tiers, tier]});
                                } else {
                                  setFormData({...formData, target_tiers: formData.target_tiers.filter(t => t !== tier)});
                                }
                              }}
                            />
                            <span className="capitalize">{tier}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Publish Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.publish_at && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.publish_at ? format(formData.publish_at, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.publish_at}
                          onSelect={(date) => date && setFormData({...formData, publish_at: date})}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Expiry Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.expires_at && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.expires_at ? format(formData.expires_at, "PPP") : "No expiry"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.expires_at || undefined}
                          onSelect={(date) => setFormData({...formData, expires_at: date || null})}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="send_email"
                      checked={formData.send_email}
                      onCheckedChange={(checked) => setFormData({...formData, send_email: checked})}
                    />
                    <Label htmlFor="send_email">Send email notification</Label>
                  </div>
                  
                  {formData.send_email && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="email_subject">Email Subject</Label>
                        <Input
                          id="email_subject"
                          value={formData.email_subject}
                          onChange={(e) => setFormData({...formData, email_subject: e.target.value})}
                          required={formData.send_email}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email_template">Email Template</Label>
                        <Textarea
                          id="email_template"
                          value={formData.email_template}
                          onChange={(e) => setFormData({...formData, email_template: e.target.value})}
                          rows={3}
                          placeholder="Use {{title}} and {{content}} for dynamic content"
                          required={formData.send_email}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingMessage ? 'Update' : 'Create'} Message
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Beta Messages</CardTitle>
          <CardDescription>Manage announcements and communications for beta users</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Publish Date</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((message) => (
                <TableRow key={message.id}>
                  <TableCell className="font-medium">{message.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {message.category.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(priorityColors[message.priority as keyof typeof priorityColors])}>
                      {message.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {message.target_all_beta ? (
                      <Badge variant="outline">All Beta</Badge>
                    ) : (
                      <Badge variant="outline">
                        {message.target_tiers?.join(', ') || 'Custom'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(message.publish_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {message.read_count[0]?.count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {message.interaction_count[0]?.count || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(message)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(message.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}