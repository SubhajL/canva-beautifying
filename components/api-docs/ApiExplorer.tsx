'use client'

import { useState } from 'react'
import { API_ENDPOINTS } from '@/lib/api-docs/api-spec'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Play, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApiExplorerProps {
  apiKey: string
  isAuthenticated: boolean
}

interface RequestState {
  isLoading: boolean
  response: any | null
  error: string | null
  status: number | null
  headers: Record<string, string> | null
  duration: number | null
}

const methodColors = {
  GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  POST: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
}

export function ApiExplorer({ apiKey, isAuthenticated }: ApiExplorerProps) {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('')
  const [pathParams, setPathParams] = useState<Record<string, string>>({})
  const [queryParams, setQueryParams] = useState<Record<string, string>>({})
  const [headers, setHeaders] = useState<Record<string, string>>({})
  const [requestBody, setRequestBody] = useState<string>('')
  const [requestState, setRequestState] = useState<RequestState>({
    isLoading: false,
    response: null,
    error: null,
    status: null,
    headers: null,
    duration: null
  })

  const selectedEndpoint = API_ENDPOINTS.find(ep => ep.id === selectedEndpointId)

  const buildUrl = () => {
    if (!selectedEndpoint) return ''
    
    let path = selectedEndpoint.path
    
    // Replace path parameters
    Object.entries(pathParams).forEach(([key, value]) => {
      path = path.replace(`{${key}}`, encodeURIComponent(value))
    })
    
    // Add query parameters
    const queryString = Object.entries(queryParams)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')
    
    const baseUrl = 'https://api.beautifyai.com'
    return `${baseUrl}${path}${queryString ? '?' + queryString : ''}`
  }

  const executeRequest = async () => {
    if (!selectedEndpoint || !isAuthenticated) return

    setRequestState({
      isLoading: true,
      response: null,
      error: null,
      status: null,
      headers: null,
      duration: null
    })

    const startTime = Date.now()
    const url = buildUrl()
    
    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...headers
    }

    try {
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: requestHeaders,
      }

      if (selectedEndpoint.requestBody && requestBody) {
        try {
          // Validate JSON
          JSON.parse(requestBody)
          options.body = requestBody
        } catch (e) {
          throw new Error('Invalid JSON in request body')
        }
      }

      const response = await fetch(url, options)
      const duration = Date.now() - startTime
      
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      let responseData
      const contentType = response.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = await response.text()
      }

      setRequestState({
        isLoading: false,
        response: responseData,
        error: null,
        status: response.status,
        headers: responseHeaders,
        duration
      })
    } catch (error) {
      const duration = Date.now() - startTime
      setRequestState({
        isLoading: false,
        response: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        status: null,
        headers: null,
        duration
      })
    }
  }

  const extractPathParams = (path: string) => {
    const matches = path.match(/\{([^}]+)\}/g)
    return matches ? matches.map(m => m.slice(1, -1)) : []
  }

  return (
    <div className="space-y-6">
      {!isAuthenticated && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please set up your API key in the Authentication tab to test endpoints.
          </AlertDescription>
        </Alert>
      )}

      {/* Endpoint Selection */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Select Endpoint</h3>
        </CardHeader>
        <CardContent>
          <Select value={selectedEndpointId} onValueChange={setSelectedEndpointId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an endpoint to test" />
            </SelectTrigger>
            <SelectContent>
              {API_ENDPOINTS.map((endpoint) => (
                <SelectItem key={endpoint.id} value={endpoint.id}>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-xs", methodColors[endpoint.method])}>
                      {endpoint.method}
                    </Badge>
                    <span className="font-mono text-sm">{endpoint.path}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedEndpoint && (
        <>
          {/* Request Configuration */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Configure Request</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {selectedEndpoint.summary}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Path Parameters */}
              {extractPathParams(selectedEndpoint.path).length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Path Parameters</Label>
                  <div className="space-y-2">
                    {extractPathParams(selectedEndpoint.path).map((param) => (
                      <div key={param}>
                        <Label htmlFor={`path-${param}`} className="text-xs">
                          {param} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`path-${param}`}
                          value={pathParams[param] || ''}
                          onChange={(e) => setPathParams({ ...pathParams, [param]: e.target.value })}
                          placeholder={`Enter ${param}`}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Query Parameters */}
              {selectedEndpoint.parameters?.filter(p => p.in === 'query').length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Query Parameters</Label>
                  <div className="space-y-2">
                    {selectedEndpoint.parameters
                      .filter(p => p.in === 'query')
                      .map((param) => (
                        <div key={param.name}>
                          <Label htmlFor={`query-${param.name}`} className="text-xs">
                            {param.name}
                            {param.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          <Input
                            id={`query-${param.name}`}
                            value={queryParams[param.name] || ''}
                            onChange={(e) => setQueryParams({ ...queryParams, [param.name]: e.target.value })}
                            placeholder={param.example || `Enter ${param.name}`}
                            className="mt-1"
                          />
                          {param.description && (
                            <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Additional Headers */}
              {selectedEndpoint.parameters?.filter(p => p.in === 'header').length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Headers</Label>
                  <div className="space-y-2">
                    {selectedEndpoint.parameters
                      .filter(p => p.in === 'header')
                      .map((param) => (
                        <div key={param.name}>
                          <Label htmlFor={`header-${param.name}`} className="text-xs">
                            {param.name}
                            {param.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          <Input
                            id={`header-${param.name}`}
                            value={headers[param.name] || ''}
                            onChange={(e) => setHeaders({ ...headers, [param.name]: e.target.value })}
                            placeholder={param.example || `Enter ${param.name}`}
                            className="mt-1"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Request Body */}
              {selectedEndpoint.requestBody && (
                <div>
                  <Label htmlFor="request-body" className="text-sm font-medium mb-2 block">
                    Request Body
                    {selectedEndpoint.requestBody.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                  <Textarea
                    id="request-body"
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder={JSON.stringify(selectedEndpoint.requestBody.schema, null, 2)}
                    className="font-mono text-sm min-h-[200px]"
                  />
                </div>
              )}

              {/* Execute Button */}
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  {buildUrl()}
                </div>
                <Button
                  onClick={executeRequest}
                  disabled={!isAuthenticated || requestState.isLoading}
                  className="min-w-[120px]"
                >
                  {requestState.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Send Request
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Response */}
          {(requestState.response || requestState.error) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Response</h3>
                  {requestState.status && (
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={requestState.status >= 200 && requestState.status < 300 ? 'default' : 'destructive'}
                      >
                        {requestState.status}
                      </Badge>
                      {requestState.duration && (
                        <span className="text-sm text-gray-500">
                          {requestState.duration}ms
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {requestState.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{requestState.error}</AlertDescription>
                  </Alert>
                ) : (
                  <Tabs defaultValue="body" className="w-full">
                    <TabsList>
                      <TabsTrigger value="body">Body</TabsTrigger>
                      <TabsTrigger value="headers">Headers</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="body">
                      <div className="bg-gray-900 dark:bg-gray-950 p-4 rounded-lg overflow-auto max-h-[500px]">
                        <pre className="text-sm text-gray-300">
                          {typeof requestState.response === 'object' 
                            ? JSON.stringify(requestState.response, null, 2)
                            : requestState.response
                          }
                        </pre>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="headers">
                      <div className="space-y-1">
                        {requestState.headers && Object.entries(requestState.headers).map(([key, value]) => (
                          <div key={key} className="flex gap-2 text-sm">
                            <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                              {key}:
                            </span>
                            <span className="font-mono text-gray-600 dark:text-gray-400">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}