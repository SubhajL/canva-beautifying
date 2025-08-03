import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavItem {
  title: string
  href: string
  icon?: LucideIcon
  badge?: string | number
  disabled?: boolean
  external?: boolean
}

interface NavSection {
  title?: string
  items: NavItem[]
}

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  sections: NavSection[]
}

const SidebarNav = React.forwardRef<HTMLDivElement, SidebarNavProps>(
  ({ className, sections, ...props }, ref) => {
    const pathname = usePathname()
    
    return (
      <nav
        ref={ref}
        className={cn("flex flex-col space-y-6", className)}
        {...props}
      >
        {sections.map((section, index) => (
          <div key={index} className="space-y-3">
            {section.title && (
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className={cn(
                      "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-base",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                      item.disabled && "pointer-events-none opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {Icon && (
                        <Icon className={cn(
                          "h-4 w-4",
                          isActive
                            ? "text-primary-foreground"
                            : "text-muted-foreground group-hover:text-accent-foreground"
                        )} />
                      )}
                      <span>{item.title}</span>
                    </div>
                    {item.badge && (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    )
  }
)
SidebarNav.displayName = "SidebarNav"

export { SidebarNav, type NavItem, type NavSection }