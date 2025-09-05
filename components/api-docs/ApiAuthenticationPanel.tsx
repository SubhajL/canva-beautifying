'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, EyeOff, Key, CheckCircle, XCircle, Copy, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApiAuthenticationPanelProps {
  className?: string
}

export function ApiAuthenticationPanel({ className }: ApiAuthenticationPanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    message: string
    details?: {
      tier?: string
      rateLimits?: {
        requests: number
        period: string
      }
      usage?: {
        used: number
        limit: number
      }
    }
  } | null>(null)

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key
    return `${key.slice(0, 4)}...${key.slice(-4)}`
  }

  const validateApiKey = async () => {
    if (!apiKey) {
      setValidationResult({
        isValid: false,
        message: 'Please enter an API key'
      })
      return
    }

    setIsValidating(true)
    setValidationResult(null)

    try {
      // Simulate API validation
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock validation logic
      if (apiKey.startsWith('bai_')) {
        setValidationResult({
          isValid: true,
          message: 'API key is valid',
          details: {
            tier: 'Pro',
            rateLimits: {
              requests: 1000,
              period: 'hour'
            },
            usage: {
              used: 234,
              limit: 1000
            }
          }
        })
      } else {
        setValidationResult({
          isValid: false,
          message: 'Invalid API key format'
        })
      }
    } catch (_error) {
      setValidationResult({
        isValid: false,
        message: 'Failed to validate API key'
      })
    } finally {
      setIsValidating(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const generateNewKey = () => {
    // This would typically open a modal or redirect to key generation
    console.log('Generate new API key')
  }

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader>
          <CardTitle>API Authentication</CardTitle>
          <CardDescription>
            Manage your API keys and test authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="test" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="test">Test Key</TabsTrigger>
              <TabsTrigger value="generate">Generate Key</TabsTrigger>
              <TabsTrigger value="manage">Manage Keys</TabsTrigger>
            </TabsList>
            
            <TabsContent value="test" className="space-y-4">
              <div>
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      className="pr-10"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      type="button"
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                  <Button
                    onClick={validateApiKey}
                    disabled={isValidating}
                  >
                    {isValidating ? 'Validating...' : 'Validate'}
                  </Button>
                </div>
              </div>

              {validationResult && (
                <Alert className={validationResult.isValid ? 'border-green-200' : 'border-red-200'}>
                  <div className="flex items-start gap-2">
                    {validationResult.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <AlertTitle className={validationResult.isValid ? 'text-green-800' : 'text-red-800'}>
                        {validationResult.message}
                      </AlertTitle>
                      {validationResult.isValid && validationResult.details && (
                        <AlertDescription className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Tier:</span>
                            <Badge>{validationResult.details.tier}</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Rate Limits:</span>{' '}
                            {validationResult.details.rateLimits?.requests} requests per {validationResult.details.rateLimits?.period}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Current Usage:</span>{' '}
                            {validationResult.details.usage?.used} / {validationResult.details.usage?.limit}
                          </div>
                        </AlertDescription>
                      )}
                    </div>
                  </div>
                </Alert>
              )}

              <div className="pt-4">
                <h4 className="text-sm font-medium mb-2">How to use your API key:</h4>
                <div className="space-y-2">
                  <div className="bg-gray-900 dark:bg-gray-950 p-3 rounded-lg">
                    <code className="text-sm text-gray-300">
                      Authorization: Bearer YOUR_API_KEY
                    </code>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Include this header in all API requests
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="generate" className="space-y-4">
              <Alert>
                <Key className="h-4 w-4" />
                <AlertTitle>Generate New API Key</AlertTitle>
                <AlertDescription className="mt-2">
                  Generate a new API key for your application. Make sure to copy it immediately as it won&apos;t be shown again.
                </AlertDescription>
              </Alert>
              
              <div>
                <Label htmlFor="key-name">Key Name (optional)</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., Production App"
                  className="mt-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Help identify this key in your dashboard
                </p>
              </div>

              <Button onClick={generateNewKey} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate New API Key
              </Button>
            </TabsContent>
            
            <TabsContent value="manage" className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Active API Keys</h4>
                
                {/* Mock API keys list */}
                <div className="space-y-2">
                  <Card>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{maskApiKey('bai_1234567890abcdef')}</span>
                          <Badge variant="outline" className="text-xs">Pro</Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Production App • Created 2 days ago
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard('bai_1234567890abcdef')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          Revoke
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{maskApiKey('bai_abcdef1234567890')}</span>
                          <Badge variant="outline" className="text-xs">Pro</Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Development • Created 1 week ago
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard('bai_abcdef1234567890')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          Revoke
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Alert>
                  <AlertDescription>
                    You can have up to 5 active API keys at a time. Revoke unused keys to maintain security.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Never expose your API key in client-side code or public repositories</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Use environment variables to store API keys securely</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Rotate your API keys regularly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Use different keys for development and production</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Monitor your API usage for unusual activity</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}