import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "./label"
import { Separator } from "./separator"

interface SettingItemProps {
  label: string
  description?: string
  children: React.ReactNode
}

const SettingItem: React.FC<SettingItemProps> = ({ label, description, children }) => {
  return (
    <div className="flex items-center justify-between space-x-4">
      <div className="flex-1 space-y-0.5">
        <Label className="text-base font-medium">{label}</Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

interface SettingsSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  children: React.ReactNode
}

const SettingsSection = React.forwardRef<HTMLDivElement, SettingsSectionProps>(
  ({ className, title, description, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-6", className)} {...props}>
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    )
  }
)
SettingsSection.displayName = "SettingsSection"

interface SettingsFormProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const SettingsForm = React.forwardRef<HTMLDivElement, SettingsFormProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-8", className)} {...props}>
        {React.Children.map(children, (child, index) => (
          <>
            {index > 0 && <Separator />}
            {child}
          </>
        ))}
      </div>
    )
  }
)
SettingsForm.displayName = "SettingsForm"

export { SettingsForm, SettingsSection, SettingItem }