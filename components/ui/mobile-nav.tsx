import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet"
import { Button } from "./button"
import { Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarNav, type NavSection } from "./sidebar-nav"

interface MobileNavProps extends React.HTMLAttributes<HTMLDivElement> {
  sections: NavSection[]
  title?: string
}

const MobileNav = React.forwardRef<HTMLDivElement, MobileNavProps>(
  ({ className, sections, title = "Menu", ...props }, ref) => {
    const [open, setOpen] = React.useState(false)
    
    return (
      <div ref={ref} className={cn("lg:hidden", className)} {...props}>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <SidebarNav sections={sections} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    )
  }
)
MobileNav.displayName = "MobileNav"

export { MobileNav }