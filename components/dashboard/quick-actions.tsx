"use client"

import { Card } from "@/components/ui/card"
import { Upload, History, CreditCard, LinkIcon } from "lucide-react"
import Link from "next/link"

const actions = [
  {
    title: "Upload Document",
    description: "Start enhancing a new document",
    icon: Upload,
    href: "/upload",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    title: "Import from Canva",
    description: "Import designs directly from Canva",
    icon: LinkIcon,
    href: "/upload?tab=canva",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
  {
    title: "View History",
    description: "Browse your enhancement history",
    icon: History,
    href: "#history",
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950",
    onClick: () => {
      document.getElementById("enhancement-history")?.scrollIntoView({
        behavior: "smooth",
      })
    },
  },
  {
    title: "Manage Subscription",
    description: "View plans and usage",
    icon: CreditCard,
    href: "/settings/billing",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950",
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon
        const isInternalLink = action.href.startsWith("#")

        const cardContent = (
          <Card
            className="group cursor-pointer transition-all duration-200 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:scale-[1.02] hover:shadow-md"
            onClick={action.onClick}
            role="button"
            tabIndex={isInternalLink ? 0 : -1}
            onKeyDown={
              isInternalLink
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      action.onClick?.()
                    }
                  }
                : undefined
            }
            aria-label={`${action.title}: ${action.description}`}
          >
            <div className="p-6">
              <div
                className={`inline-flex rounded-lg p-3 ${action.bgColor} mb-4`}
                aria-hidden="true"
              >
                <Icon className={`h-6 w-6 ${action.color}`} />
              </div>
              <h3 className="mb-1 text-sm font-semibold transition-colors group-hover:text-primary">
                {action.title}
              </h3>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {action.description}
              </p>
            </div>
          </Card>
        )

        if (isInternalLink) {
          return <div key={action.title}>{cardContent}</div>
        }

        return (
          <Link key={action.title} href={action.href}>
            {cardContent}
          </Link>
        )
      })}
    </div>
  )
}
