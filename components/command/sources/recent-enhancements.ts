import type { Command } from "@/contexts/command-palette"

export type RecentEnhancement = {
  id: string
  documentName?: string
  createdAt?: string
}

const GROUP = "Recent results"

type Fetcher = (userId: string, limit: number) => Promise<RecentEnhancement[]>

export function mapEnhancementToCommand(
  e: Pick<RecentEnhancement, "id" | "documentName">
): Pick<Command, "id" | "label" | "href" | "group"> {
  const labelName = e.documentName?.trim() || e.id
  return {
    id: `recent-${e.id}`,
    label: `Open Results: ${labelName}`,
    href: `/results/${e.id}`,
    group: GROUP,
  }
}

export function createRecentEnhancementsSource({
  fetcher,
  userId,
  limit = 5,
}: {
  fetcher: Fetcher
  userId: string
  limit?: number
}) {
  return {
    id: "recent-enhancements",
    getCommands: async () => {
      try {
        const items = await fetcher(userId, limit)
        const sorted = [...items].sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0
          return tb - ta
        })
        return sorted.slice(0, limit).map(mapEnhancementToCommand)
      } catch {
        return []
      }
    },
  }
}
