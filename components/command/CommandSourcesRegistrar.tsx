'use client'

import { useEffect } from 'react'
import { useCommandPalette } from '@/contexts/command-palette'
import { staticRoutes, recentResults } from '@/lib/command/sources'
import { useAuth } from '@/contexts/auth-context'

export function CommandSourcesRegistrar() {
  const { registerSource } = useCommandPalette()
  const { user } = useAuth()

  useEffect(() => {
    const unregisterStatic = registerSource({ id: 'static', getCommands: () => staticRoutes() })
    return unregisterStatic
  }, [registerSource])

  useEffect(() => {
    const unregisterRecent = registerSource({
      id: 'recent',
      getCommands: () => recentResults(user?.id),
    })
    return unregisterRecent
  }, [registerSource, user?.id])

  return null
}

