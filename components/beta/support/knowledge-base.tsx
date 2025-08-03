'use client'

import { useState, useEffect } from 'react'
import { Search, Book, ThumbsUp, ThumbsDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'

interface KBArticle {
  id: string
  title: string
  slug: string
  content: string
  category: string
  tags: string[]
  view_count: number
  helpful_count: number
  created_at: string
  author: {
    full_name: string
  }
}

interface KnowledgeBaseProps {
  onArticleSelect?: (article: KBArticle) => void
  searchQuery?: string
  embedded?: boolean
}

export function KnowledgeBase({ onArticleSelect, searchQuery: initialQuery = '', embedded = false }: KnowledgeBaseProps) {
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchArticles()
  }, [searchQuery, selectedCategory])

  useEffect(() => {
    setSearchQuery(initialQuery)
  }, [initialQuery])

  const fetchArticles = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('kb_articles')
        .select(`
          *,
          author:author_id(full_name)
        `)
        .eq('is_published', true)

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
      }

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory)
      }

      const { data, error } = await query
        .order('helpful_count', { ascending: false })
        .order('view_count', { ascending: false })

      if (error) throw error

      setArticles(data || [])

      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map(a => a.category) || [])]
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const recordView = async (articleId: string) => {
    try {
      await supabase
        .from('kb_articles')
        .update({ view_count: articles.find(a => a.id === articleId)?.view_count || 0 + 1 })
        .eq('id', articleId)
    } catch (error) {
      console.error('Error recording view:', error)
    }
  }

  const submitFeedback = async (articleId: string, isHelpful: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: 'Please sign in',
          description: 'You need to be signed in to provide feedback',
          variant: 'destructive'
        })
        return
      }

      const { error } = await supabase
        .from('kb_article_feedback')
        .upsert({
          article_id: articleId,
          user_id: user.id,
          is_helpful: isHelpful
        })

      if (error) throw error

      toast({
        title: 'Thank you!',
        description: 'Your feedback helps us improve our knowledge base'
      })

      // Update helpful count if positive feedback
      if (isHelpful) {
        const article = articles.find(a => a.id === articleId)
        if (article) {
          await supabase
            .from('kb_articles')
            .update({ helpful_count: article.helpful_count + 1 })
            .eq('id', articleId)
        }
      }

      fetchArticles()
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit feedback',
        variant: 'destructive'
      })
    }
  }

  const highlightText = (text: string, query: string) => {
    if (!query) return text
    const regex = new RegExp(`(${query})`, 'gi')
    return text.split(regex).map((part, index) =>
      regex.test(part) ? <mark key={index} className="bg-yellow-200">{part}</mark> : part
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading articles...</div>
  }

  return (
    <div className={embedded ? '' : 'container mx-auto p-6'}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
          <p className="text-muted-foreground">Find answers to common questions</p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
      </div>

      {/* Articles */}
      <ScrollArea className={embedded ? 'h-[400px]' : 'h-auto'}>
        <div className="space-y-4">
          {articles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Book className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No articles found</p>
              </CardContent>
            </Card>
          ) : (
            articles.map((article) => (
              <Card
                key={article.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  recordView(article.id)
                  onArticleSelect?.(article)
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {highlightText(article.title, searchQuery)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary">{article.category}</Badge>
                        {article.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {highlightText(article.content.substring(0, 200) + '...', searchQuery)}
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{article.view_count} views</span>
                      <span>{article.helpful_count} found helpful</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          submitFeedback(article.id, true)
                        }}
                      >
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Helpful
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          submitFeedback(article.id, false)
                        }}
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}