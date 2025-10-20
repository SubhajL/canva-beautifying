"use client"

import { ApiEndpoint } from "@/lib/api-docs/api-spec"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Copy, CheckCircle } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { CodeSnippetGenerator } from "./CodeSnippetGenerator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EndpointCardProps {
  endpoint: ApiEndpoint
  isExpanded: boolean
  onToggle: () => void
}

const methodColors = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  POST: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  PUT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  PATCH:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
}

export function EndpointCard({
  endpoint,
  isExpanded,
  onToggle,
}: EndpointCardProps) {
  const [copiedPath, setCopiedPath] = useState(false)

  const handleCopyPath = () => {
    navigator.clipboard.writeText(`https://api.beautifyai.com${endpoint.path}`)
    setCopiedPath(true)
    setTimeout(() => setCopiedPath(false), 2000)
  }

  return (
    <Card className="overflow-hidden border-gray-200 dark:border-gray-700">
      <CardHeader
        className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center gap-3">
            <Badge className={cn("font-mono", methodColors[endpoint.method])}>
              {endpoint.method}
            </Badge>
            <code className="flex-1 font-mono text-sm text-gray-700 dark:text-gray-300">
              {endpoint.path}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation()
                handleCopyPath()
              }}
            >
              {copiedPath ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-500" />
              )}
            </Button>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {endpoint.summary}
        </p>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                Description
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {endpoint.description}
              </p>
            </div>

            {/* Authentication */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                Authentication
              </h4>
              <Badge
                variant={endpoint.authentication ? "default" : "secondary"}
              >
                {endpoint.authentication ? "Required" : "Not Required"}
              </Badge>
            </div>

            {/* Parameters */}
            {endpoint.parameters && endpoint.parameters.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Parameters
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b dark:border-gray-700">
                        <th className="py-2 pr-4 text-left font-medium text-gray-700 dark:text-gray-300">
                          Name
                        </th>
                        <th className="py-2 pr-4 text-left font-medium text-gray-700 dark:text-gray-300">
                          Type
                        </th>
                        <th className="py-2 pr-4 text-left font-medium text-gray-700 dark:text-gray-300">
                          In
                        </th>
                        <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.parameters.map((param) => (
                        <tr
                          key={param.name}
                          className="border-b dark:border-gray-700"
                        >
                          <td className="py-2 pr-4">
                            <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                              {param.name}
                            </code>
                            {param.required && (
                              <span className="ml-1 text-red-500">*</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                            {param.type}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant="outline" className="text-xs">
                              {param.in}
                            </Badge>
                          </td>
                          <td className="py-2 text-gray-600 dark:text-gray-400">
                            {param.description}
                            {param.example && (
                              <div className="mt-1">
                                <span className="text-xs text-gray-500">
                                  Example:{" "}
                                </span>
                                <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                                  {param.example}
                                </code>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Request Body */}
            {endpoint.requestBody && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Request Body
                  {endpoint.requestBody.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </h4>
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                  Content-Type:{" "}
                  <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                    {endpoint.requestBody.contentType}
                  </code>
                </p>
                <div className="overflow-x-auto rounded-lg bg-gray-900 p-4 dark:bg-gray-950">
                  <pre className="text-sm text-gray-300">
                    {JSON.stringify(endpoint.requestBody.schema, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Responses */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                Responses
              </h4>
              <div className="space-y-3">
                {endpoint.responses.map((response) => (
                  <div
                    key={response.status}
                    className="rounded-lg border p-3 dark:border-gray-700"
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          response.status >= 200 && response.status < 300
                            ? "border-green-200 bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "border-red-200 bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300"
                        )}
                      >
                        {response.status}
                      </Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {response.description}
                      </span>
                    </div>
                    {response.schema && (
                      <div className="overflow-x-auto rounded-lg bg-gray-900 p-3 dark:bg-gray-950">
                        <pre className="text-xs text-gray-300">
                          {JSON.stringify(response.schema, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Code Examples */}
            {endpoint.examples && endpoint.examples.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Examples
                </h4>
                <Tabs defaultValue="example-0" className="w-full">
                  <TabsList className="mb-4">
                    {endpoint.examples.map((example, index) => (
                      <TabsTrigger key={index} value={`example-${index}`}>
                        {example.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {endpoint.examples.map((example, index) => (
                    <TabsContent key={index} value={`example-${index}`}>
                      {example.description && (
                        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                          {example.description}
                        </p>
                      )}
                      <CodeSnippetGenerator
                        endpoint={endpoint}
                        example={example}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
