import type { Command } from "@/contexts/command-palette"

// Group label used for all static navigation commands
const NAV_GROUP = "Navigation"

export type StaticRoute = {
  id: string
  label: string
  href: string
}

export function buildStaticRouteCommands(
  routes?: StaticRoute[]
): Array<Pick<Command, "id" | "label" | "href" | "group">> {
  const baseRoutes: StaticRoute[] = routes ?? [
    { id: "nav-dashboard", label: "Dashboard", href: "/dashboard" },
    { id: "nav-upload", label: "Upload", href: "/upload" },
    { id: "nav-history", label: "History", href: "/history" },
    { id: "nav-settings", label: "Settings", href: "/settings" },
  ]

  return baseRoutes.map((r) => ({
    id: r.id,
    label: r.label,
    href: r.href,
    group: NAV_GROUP,
  }))
}

export function createStaticRoutesSource(
  routes?: Array<Pick<Command, "id" | "label" | "href" | "group">>
) {
  return {
    id: "static-routes",
    getCommands: () => routes ?? buildStaticRouteCommands(),
  }
}
