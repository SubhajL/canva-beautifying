'use client'

import { useState, useCallback } from 'react'
import type { ApiEndpoint } from '@/lib/api-docs/api-spec'

export interface ApiRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export interface ApiResponse {
  status: number | null
  statusText: string | null
  headers: Record<string, string> | null
  data: unknown | null
  error: string | null
  duration: number | null
}

export function useApiExplorer(baseUrl = '') {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<ApiResponse>({
    status: null,
    statusText: null,
    headers: null,
    data: null,
    error: null,
    duration: null
  })

  const buildUrl = useCallback((
    endpoint: ApiEndpoint,
    pathParams: Record<string, string>,
    queryParams: Record<string, string>
  ) => {
    let url = endpoint.path

    // Replace path parameters
    Object.entries(pathParams).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(value))
    })

    // Add query parameters
    const filteredQuery = Object.entries(queryParams).filter(([_, value]) => value)
    if (filteredQuery.length > 0) {
      const queryString = new URLSearchParams(
        Object.fromEntries(filteredQuery)
      ).toString()
      url = `${url}?${queryString}`
    }

    return `${baseUrl}${url}`
  }, [baseUrl])

  const executeRequest = useCallback(async (request: ApiRequest) => {
    setLoading(true)
    setResponse({
      status: null,
      statusText: null,
      headers: null,
      data: null,
      error: null,
      duration: null
    })

    const startTime = Date.now()

    try {
      const options: RequestInit = {
        method: request.method,
        headers: request.headers
      }

      if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        options.body = request.body
      }

      const res = await fetch(request.url, options)
      const duration = Date.now() - startTime

      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      let data = null
      const contentType = res.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        try {
          data = await res.json()
        } catch (e) {
          data = await res.text()
        }
      } else {
        data = await res.text()
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        data,
        error: null,
        duration
      })
    } catch (error) {
      const duration = Date.now() - startTime
      setResponse({
        status: null,
        statusText: null,
        headers: null,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        duration
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const resetResponse = useCallback(() => {
    setResponse({
      status: null,
      statusText: null,
      headers: null,
      data: null,
      error: null,
      duration: null
    })
  }, [])

  return {
    loading,
    response,
    buildUrl,
    executeRequest,
    resetResponse
  }
}