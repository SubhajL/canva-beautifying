"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  Upload,
  Home,
  History,
  Settings,
  LogOut,
  Menu,
  FlaskConical,
  Activity,
  Maximize2,
  Minimize2,
  Search,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth"
import { createClient } from "@/lib/supabase/client"
import { BetaNotificationBadge } from "@/components/beta/BetaNotificationBadge"
import { useDensity } from "@/contexts/density"
import { useCommandPalette } from "@/contexts/command-palette"

export function AppHeader() {
  const { user } = useAuth()
  const { mode, toggle } = useDensity()
  const { togglePalette } = useCommandPalette()
  const [isBetaUser, setIsBetaUser] = useState(false)

  useEffect(() => {
    const checkBetaStatus = async () => {
      if (!user) return

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("user_profiles")
          .select("is_beta_user")
          .eq("id", user.id)
          .single()

        if (!error && data) {
          setIsBetaUser(data.is_beta_user || false)
        }
      } catch (error) {
        console.error("Error checking beta status:", error)
      }
    }

    checkBetaStatus()
  }, [user])

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="container mx-auto px-4" aria-label="Global">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-primary to-secondary">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                BeautifyAI
              </span>
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-700 transition-colors hover:text-primary"
              >
                Dashboard
              </Link>
              <Link
                href="/upload"
                className="text-sm font-medium text-gray-700 transition-colors hover:text-primary"
              >
                Upload
              </Link>
              <Link
                href="/history"
                className="text-sm font-medium text-gray-700 transition-colors hover:text-primary"
              >
                History
              </Link>
              {isBetaUser && (
                <Link
                  href="/beta/dashboard"
                  className="flex items-center gap-1 text-sm font-medium text-gray-700 transition-colors hover:text-primary"
                >
                  <FlaskConical className="h-4 w-4" />
                  Beta
                </Link>
              )}
              {user?.subscription_tier === "admin" && (
                <Link
                  href="/monitoring"
                  className="flex items-center gap-1 text-sm font-medium text-gray-700 transition-colors hover:text-primary"
                >
                  <Activity className="h-4 w-4" />
                  Monitoring
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="secondary">Free Plan • 8/10 uses</Badge>

            {isBetaUser && <BetaNotificationBadge />}

            <Link href="/upload" className="hidden md:block">
              <Button variant="gradient" size="sm" className="gap-2">
                <Upload className="h-4 w-4" />
                New Upload
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={togglePalette}
              aria-label="Open command palette (⌘K)"
              title="Open command palette (⌘K)"
            >
              <Search className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={`Switch to ${mode === "comfortable" ? "compact" : "comfortable"} mode`}
              title={`Switch to ${mode === "comfortable" ? "compact" : "comfortable"} mode`}
            >
              {mode === "comfortable" ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer">
                    <Home className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/upload" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    New Upload
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/history" className="cursor-pointer">
                    <History className="mr-2 h-4 w-4" />
                    History
                  </Link>
                </DropdownMenuItem>
                {isBetaUser && (
                  <DropdownMenuItem asChild>
                    <Link href="/beta/dashboard" className="cursor-pointer">
                      <FlaskConical className="mr-2 h-4 w-4" />
                      Beta Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {user?.subscription_tier === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/monitoring" className="cursor-pointer">
                      <Activity className="mr-2 h-4 w-4" />
                      Monitoring
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
    </header>
  )
}
