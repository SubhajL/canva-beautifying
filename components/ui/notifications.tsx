"use client"

import { useEffect, useState } from "react"
import { X, CheckCircle, AlertCircle, Info, XCircle } from "lucide-react"
import { useWebSocketConnection } from "@/contexts/websocket-context"
import { cn } from "@/lib/utils"

export function Notifications() {
  const { notifications, clearNotification } = useWebSocketConnection()
  const [visible, setVisible] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Show new notifications with animation
    notifications.forEach((notification) => {
      if (!visible.has(notification.id)) {
        setTimeout(() => {
          setVisible((prev) => new Set(prev).add(notification.id))
        }, 100)
      }
    })
  }, [notifications, visible])

  const handleClose = (id: string) => {
    // Fade out animation
    setVisible((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

    // Remove after animation
    setTimeout(() => {
      clearNotification(id)
    }, 300)
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "transform rounded-lg p-4 pr-12 shadow-lg transition-all duration-300",
            visible.has(notification.id)
              ? "translate-x-0 opacity-100"
              : "translate-x-full opacity-0",
            {
              "border border-gray-200 bg-white": notification.type === "info",
              "border border-green-200 bg-green-50":
                notification.type === "success",
              "border border-yellow-200 bg-yellow-50":
                notification.type === "warning",
              "border border-red-200 bg-red-50": notification.type === "error",
            }
          )}
        >
          <div className="flex items-start gap-3">
            {notification.type === "success" && (
              <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
            )}
            {notification.type === "error" && (
              <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
            )}
            {notification.type === "warning" && (
              <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600" />
            )}
            {notification.type === "info" && (
              <Info className="mt-0.5 h-5 w-5 text-blue-600" />
            )}

            <div className="flex-1">
              <h4
                className={cn("text-sm font-medium", {
                  "text-gray-900": notification.type === "info",
                  "text-green-900": notification.type === "success",
                  "text-yellow-900": notification.type === "warning",
                  "text-red-900": notification.type === "error",
                })}
              >
                {notification.title}
              </h4>
              <p
                className={cn("mt-1 text-sm", {
                  "text-gray-600": notification.type === "info",
                  "text-green-700": notification.type === "success",
                  "text-yellow-700": notification.type === "warning",
                  "text-red-700": notification.type === "error",
                })}
              >
                {notification.message}
              </p>
              {notification.actionUrl && (
                <a
                  href={notification.actionUrl}
                  className={cn(
                    "mt-2 inline-block text-sm font-medium hover:underline",
                    {
                      "text-blue-600": notification.type === "info",
                      "text-green-600": notification.type === "success",
                      "text-yellow-600": notification.type === "warning",
                      "text-red-600": notification.type === "error",
                    }
                  )}
                >
                  View Details →
                </a>
              )}
            </div>
          </div>

          <button
            onClick={() => handleClose(notification.id)}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
