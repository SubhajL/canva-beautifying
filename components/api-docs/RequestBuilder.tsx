"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ApiParameter, ApiRequestBody } from "@/lib/api-docs/api-spec"

interface RequestBuilderProps {
  pathParams?: string[]
  queryParams?: ApiParameter[]
  headerParams?: ApiParameter[]
  requestBody?: ApiRequestBody
  values: {
    pathParams: Record<string, string>
    queryParams: Record<string, string>
    headers: Record<string, string>
    body: string
  }
  onChange: (
    type: "pathParams" | "queryParams" | "headers" | "body",
    key: string,
    value: string
  ) => void
  className?: string
}

export function RequestBuilder({
  pathParams = [],
  queryParams = [],
  headerParams = [],
  requestBody,
  values,
  onChange,
  className,
}: RequestBuilderProps) {
  const handleChange = (
    type: "pathParams" | "queryParams" | "headers" | "body",
    key: string,
    value: string
  ) => {
    onChange(type, key, value)
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Path Parameters */}
      {pathParams.length > 0 && (
        <div>
          <Label className="mb-3 block text-sm font-medium">
            Path Parameters
          </Label>
          <div className="space-y-3">
            {pathParams.map((param) => (
              <div key={param}>
                <div className="mb-1 flex items-center gap-2">
                  <Label htmlFor={`path-${param}`} className="text-sm">
                    {param}
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    Required
                  </Badge>
                </div>
                <Input
                  id={`path-${param}`}
                  value={values.pathParams[param] || ""}
                  onChange={(e) =>
                    handleChange("pathParams", param, e.target.value)
                  }
                  placeholder={`Enter ${param}`}
                  className="font-mono"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Parameters */}
      {queryParams.length > 0 && (
        <div>
          <Label className="mb-3 block text-sm font-medium">
            Query Parameters
          </Label>
          <div className="space-y-3">
            {queryParams.map((param) => (
              <div key={param.name}>
                <div className="mb-1 flex items-center gap-2">
                  <Label htmlFor={`query-${param.name}`} className="text-sm">
                    {param.name}
                  </Label>
                  {param.required && (
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {param.type && (
                    <Badge variant="outline" className="text-xs">
                      {param.type}
                    </Badge>
                  )}
                </div>
                {param.enum ? (
                  <Select
                    value={values.queryParams[param.name] || ""}
                    onValueChange={(value) =>
                      handleChange("queryParams", param.name, value)
                    }
                  >
                    <SelectTrigger id={`query-${param.name}`}>
                      <SelectValue placeholder={`Select ${param.name}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {param.enum.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`query-${param.name}`}
                    value={values.queryParams[param.name] || ""}
                    onChange={(e) =>
                      handleChange("queryParams", param.name, e.target.value)
                    }
                    placeholder={param.example || `Enter ${param.name}`}
                    className="font-mono"
                  />
                )}
                {param.description && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {param.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header Parameters */}
      {headerParams.length > 0 && (
        <div>
          <Label className="mb-3 block text-sm font-medium">Headers</Label>
          <div className="space-y-3">
            {headerParams.map((param) => (
              <div key={param.name}>
                <div className="mb-1 flex items-center gap-2">
                  <Label htmlFor={`header-${param.name}`} className="text-sm">
                    {param.name}
                  </Label>
                  {param.required && (
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <Input
                  id={`header-${param.name}`}
                  value={values.headers[param.name] || ""}
                  onChange={(e) =>
                    handleChange("headers", param.name, e.target.value)
                  }
                  placeholder={param.example || `Enter ${param.name}`}
                  className="font-mono"
                />
                {param.description && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {param.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Body */}
      {requestBody && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Label htmlFor="request-body" className="text-sm font-medium">
              Request Body
            </Label>
            {requestBody.required && (
              <Badge variant="secondary" className="text-xs">
                Required
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {requestBody.contentType || "application/json"}
            </Badge>
          </div>
          <Textarea
            id="request-body"
            value={values.body}
            onChange={(e) => handleChange("body", "content", e.target.value)}
            placeholder={JSON.stringify(requestBody.schema, null, 2)}
            className="min-h-[200px] font-mono text-sm"
            spellCheck={false}
          />
          {requestBody.description && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {requestBody.description}
            </p>
          )}
        </div>
      )}

      {pathParams.length === 0 &&
        queryParams.length === 0 &&
        headerParams.length === 0 &&
        !requestBody && (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No parameters required for this endpoint</p>
          </div>
        )}
    </div>
  )
}
