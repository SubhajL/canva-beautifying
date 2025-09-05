'use client'

import { useState } from 'react'
import { API_ENDPOINTS, getAllTags, getEndpointsByTag, ApiEndpoint } from '@/lib/api-docs/api-spec'
import { EndpointCard } from './EndpointCard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function ApiDocumentationViewer() {
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())

  const tags = ['all', ...getAllTags()]

  const filteredEndpoints = API_ENDPOINTS.filter(endpoint => {
    const matchesTag = selectedTag === 'all' || endpoint.tags.includes(selectedTag)
    const matchesSearch = searchTerm === '' || 
      endpoint.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesTag && matchesSearch
  })

  const toggleEndpoint = (endpointId: string) => {
    const newExpanded = new Set(expandedEndpoints)
    if (newExpanded.has(endpointId)) {
      newExpanded.delete(endpointId)
    } else {
      newExpanded.add(endpointId)
    }
    setExpandedEndpoints(newExpanded)
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search endpoints..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <ScrollArea className="w-full md:w-auto">
          <div className="flex gap-2 pb-2">
            {tags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTag === tag ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => setSelectedTag(tag)}
              >
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </Badge>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Authentication Section */}
      <Card id="authentication" className="border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Authentication
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            All API requests must include an API key in the Authorization header:
          </p>
          <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
            <code className="text-sm text-gray-800 dark:text-gray-200">
              Authorization: Bearer YOUR_API_KEY
            </code>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mt-4">
            You can obtain an API key from your dashboard. Keep your API key secure and never expose it in client-side code.
          </p>
        </CardContent>
      </Card>

      {/* Rate Limits Section */}
      <Card id="rate-limits" className="border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Rate Limits
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            API requests are subject to rate limiting to ensure fair usage:
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <span className="font-medium">Global Rate Limit</span>
              <span className="text-gray-600 dark:text-gray-400">100 requests per minute</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <span className="font-medium">Enhancement Requests</span>
              <span className="text-gray-600 dark:text-gray-400">Tier-based limits apply</span>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mt-4">
            Rate limit information is included in response headers: <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">X-RateLimit-*</code>
          </p>
        </CardContent>
      </Card>

      {/* Error Handling Section */}
      <Card id="errors" className="border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Error Handling
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            The API uses standard HTTP response codes and returns errors in a consistent format:
          </p>
          <div className="bg-gray-900 dark:bg-gray-950 p-4 rounded-lg mb-4">
            <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "window": "1m",
      "retryAfter": 42
    }
  }
}`}
            </pre>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">200</Badge>
              <span className="text-gray-600 dark:text-gray-300">Success</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">400</Badge>
              <span className="text-gray-600 dark:text-gray-300">Bad Request</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">401</Badge>
              <span className="text-gray-600 dark:text-gray-300">Unauthorized</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">429</Badge>
              <span className="text-gray-600 dark:text-gray-300">Rate Limit Exceeded</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">500</Badge>
              <span className="text-gray-600 dark:text-gray-300">Internal Server Error</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints Section */}
      <div id="endpoints" className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          API Endpoints
        </h2>
        
        {filteredEndpoints.length === 0 ? (
          <Card className="p-8 text-center border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">
              No endpoints found matching your search criteria.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEndpoints.map((endpoint) => (
              <EndpointCard
                key={endpoint.id}
                endpoint={endpoint}
                isExpanded={expandedEndpoints.has(endpoint.id)}
                onToggle={() => toggleEndpoint(endpoint.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}