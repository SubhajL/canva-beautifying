'use client'

import { useState } from 'react'
import { ApiEndpoint, ApiExample } from '@/lib/api-docs/api-spec'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Copy, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeSnippetGeneratorProps {
  endpoint: ApiEndpoint
  example?: ApiExample
}

interface CodeLanguage {
  id: string
  name: string
  highlight: string
  generator: (endpoint: ApiEndpoint, example?: ApiExample) => string
}

const languages: CodeLanguage[] = [
  {
    id: 'curl',
    name: 'cURL',
    highlight: 'bash',
    generator: (endpoint, example) => {
      const baseUrl = 'https://api.beautifyai.com'
      let snippet = `curl -X ${endpoint.method} "${baseUrl}${endpoint.path}"`
      
      if (endpoint.authentication) {
        snippet += ' \\\n  -H "Authorization: Bearer YOUR_API_KEY"'
      }
      
      if (endpoint.requestBody) {
        snippet += ' \\\n  -H "Content-Type: application/json"'
        if (example?.request) {
          snippet += ` \\\n  -d '${JSON.stringify(example.request, null, 2)}'`
        } else {
          snippet += ` \\\n  -d '${JSON.stringify(endpoint.requestBody.schema, null, 2)}'`
        }
      }
      
      if (endpoint.parameters?.some(p => p.in === 'header')) {
        endpoint.parameters
          .filter(p => p.in === 'header' && p.name !== 'Authorization')
          .forEach(p => {
            snippet += ` \\\n  -H "${p.name}: ${p.example || 'VALUE'}"` 
          })
      }
      
      return snippet
    }
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    highlight: 'javascript',
    generator: (endpoint, example) => {
      const baseUrl = 'https://api.beautifyai.com'
      const headers: Record<string, string> = {}
      
      if (endpoint.authentication) {
        headers['Authorization'] = 'Bearer YOUR_API_KEY'
      }
      
      if (endpoint.requestBody) {
        headers['Content-Type'] = 'application/json'
      }
      
      endpoint.parameters?.filter(p => p.in === 'header' && p.name !== 'Authorization')
        .forEach(p => {
          headers[p.name] = p.example || 'VALUE'
        })
      
      let snippet = `const response = await fetch('${baseUrl}${endpoint.path}', {
  method: '${endpoint.method}',`
      
      if (Object.keys(headers).length > 0) {
        snippet += `\n  headers: ${JSON.stringify(headers, null, 4).split('\n').join('\n  ')},`
      }
      
      if (endpoint.requestBody && example?.request) {
        snippet += `\n  body: JSON.stringify(${JSON.stringify(example.request, null, 4).split('\n').join('\n  ')}),`
      } else if (endpoint.requestBody) {
        snippet += `\n  body: JSON.stringify(${JSON.stringify(endpoint.requestBody.schema, null, 4).split('\n').join('\n  ')}),`
      }
      
      snippet += '\n});\n\nconst data = await response.json();'
      
      return snippet
    }
  },
  {
    id: 'python',
    name: 'Python',
    highlight: 'python',
    generator: (endpoint, example) => {
      const baseUrl = 'https://api.beautifyai.com'
      let snippet = 'import requests\n\n'
      
      const headers: Record<string, string> = {}
      
      if (endpoint.authentication) {
        headers['Authorization'] = 'Bearer YOUR_API_KEY'
      }
      
      if (endpoint.requestBody) {
        headers['Content-Type'] = 'application/json'
      }
      
      endpoint.parameters?.filter(p => p.in === 'header' && p.name !== 'Authorization')
        .forEach(p => {
          headers[p.name] = p.example || 'VALUE'
        })
      
      snippet += `response = requests.${endpoint.method.toLowerCase()}(\n`
      snippet += `    '${baseUrl}${endpoint.path}',\n`
      
      if (Object.keys(headers).length > 0) {
        snippet += `    headers=${JSON.stringify(headers, null, 4).replace(/"/g, "'").split('\n').join('\n    ')},\n`
      }
      
      if (endpoint.requestBody) {
        const data = example?.request || endpoint.requestBody.schema
        snippet += `    json=${JSON.stringify(data, null, 4).split('\n').join('\n    ')}\n`
      }
      
      snippet += ')\n\ndata = response.json()'
      
      return snippet
    }
  },
  {
    id: 'node',
    name: 'Node.js',
    highlight: 'javascript',
    generator: (endpoint, example) => {
      let snippet = "const https = require('https');\n\n"
      
      const options: any = {
        hostname: 'api.beautifyai.com',
        path: endpoint.path,
        method: endpoint.method,
        headers: {}
      }
      
      if (endpoint.authentication) {
        options.headers['Authorization'] = 'Bearer YOUR_API_KEY'
      }
      
      if (endpoint.requestBody) {
        options.headers['Content-Type'] = 'application/json'
      }
      
      endpoint.parameters?.filter(p => p.in === 'header' && p.name !== 'Authorization')
        .forEach(p => {
          options.headers[p.name] = p.example || 'VALUE'
        })
      
      snippet += `const options = ${JSON.stringify(options, null, 2)};\n\n`
      snippet += 'const req = https.request(options, (res) => {\n'
      snippet += '  let data = \'\';\n'
      snippet += '  res.on(\'data\', (chunk) => data += chunk);\n'
      snippet += '  res.on(\'end\', () => console.log(JSON.parse(data)));\n'
      snippet += '});\n\n'
      
      if (endpoint.requestBody) {
        const data = example?.request || endpoint.requestBody.schema
        snippet += `req.write(JSON.stringify(${JSON.stringify(data, null, 2)}));\n`
      }
      
      snippet += 'req.end();'
      
      return snippet
    }
  },
  {
    id: 'php',
    name: 'PHP',
    highlight: 'php',
    generator: (endpoint, example) => {
      const baseUrl = 'https://api.beautifyai.com'
      let snippet = '<?php\n\n'
      
      snippet += '$ch = curl_init();\n\n'
      snippet += `curl_setopt($ch, CURLOPT_URL, '${baseUrl}${endpoint.path}');\n`
      snippet += 'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n'
      snippet += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${endpoint.method}');\n`
      
      const headers: string[] = []
      
      if (endpoint.authentication) {
        headers.push('Authorization: Bearer YOUR_API_KEY')
      }
      
      if (endpoint.requestBody) {
        headers.push('Content-Type: application/json')
      }
      
      endpoint.parameters?.filter(p => p.in === 'header' && p.name !== 'Authorization')
        .forEach(p => {
          headers.push(`${p.name}: ${p.example || 'VALUE'}`)
        })
      
      if (headers.length > 0) {
        snippet += 'curl_setopt($ch, CURLOPT_HTTPHEADER, [\n'
        headers.forEach(h => {
          snippet += `    '${h}',\n`
        })
        snippet += ']);\n'
      }
      
      if (endpoint.requestBody) {
        const data = example?.request || endpoint.requestBody.schema
        snippet += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${JSON.stringify(data, null, 2)}');\n`
      }
      
      snippet += '\n$response = curl_exec($ch);\n'
      snippet += 'curl_close($ch);\n\n'
      snippet += '$data = json_decode($response, true);\n'
      snippet += 'print_r($data);'
      
      return snippet
    }
  }
]

export function CodeSnippetGenerator({ endpoint, example }: CodeSnippetGeneratorProps) {
  const [copied, setCopied] = useState<string | null>(null)
  
  const handleCopy = (code: string, langId: string) => {
    navigator.clipboard.writeText(code)
    setCopied(langId)
    setTimeout(() => setCopied(null), 2000)
  }
  
  return (
    <Tabs defaultValue="curl" className="w-full">
      <TabsList className="grid grid-cols-5 w-full mb-4">
        {languages.map((lang) => (
          <TabsTrigger key={lang.id} value={lang.id}>
            {lang.name}
          </TabsTrigger>
        ))}
      </TabsList>
      
      {languages.map((lang) => {
        const code = lang.generator(endpoint, example)
        
        return (
          <TabsContent key={lang.id} value={lang.id}>
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-2 top-2 z-10"
                onClick={() => handleCopy(code, lang.id)}
              >
                {copied === lang.id ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              
              <div className={cn(
                "bg-gray-900 dark:bg-gray-950 p-4 rounded-lg overflow-x-auto",
                "language-" + lang.highlight
              )}>
                <pre className="text-sm text-gray-300">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}