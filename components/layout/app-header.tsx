"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  Upload,
  Home,
  History,
  Settings,
  LogOut,
  Menu,
  FlaskConical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from '@/contexts/auth'
import { createClient } from '@/lib/supabase/client'
import { BetaNotificationBadge } from '@/components/beta/BetaNotificationBadge'

export function AppHeader() {
  const { user } = useAuth();
  const [isBetaUser, setIsBetaUser] = useState(false);

  useEffect(() => {
    const checkBetaStatus = async () => {
      if (!user) return;
      
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('user_profiles')
          .select('is_beta_user')
          .eq('id', user.id)
          .single();
        
        if (!error && data) {
          setIsBetaUser(data.is_beta_user || false);
        }
      } catch (error) {
        console.error('Error checking beta status:', error);
      }
    };

    checkBetaStatus();
  }, [user]);
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="container mx-auto px-4" aria-label="Global">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">BeautifyAI</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/upload" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                Upload
              </Link>
              <Link href="/history" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                History
              </Link>
              {isBetaUser && (
                <Link href="/beta/dashboard" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors flex items-center gap-1">
                  <FlaskConical className="h-4 w-4" />
                  Beta
                </Link>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              Free Plan • 8/10 uses
            </Badge>
            
            {isBetaUser && (
              <BetaNotificationBadge />
            )}
            
            <Link href="/upload" className="hidden md:block">
              <Button variant="gradient" size="sm" className="gap-2">
                <Upload className="h-4 w-4" />
                New Upload
              </Button>
            </Link>
            
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
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive cursor-pointer">
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