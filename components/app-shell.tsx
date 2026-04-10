"use client"

import { Suspense, useState } from "react"
import { Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppNav } from "@/components/app-nav"
import { NoProjectSelected } from "@/components/no-project-selected"

type Role = "owner" | "manager" | "member" | "viewer"

export function AppShell({
  children,
  initialRole,
}: {
  children: React.ReactNode
  initialRole?: Role
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar wrapper — fixed overlay on mobile, static on desktop */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:static lg:z-auto",
          "transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <Suspense
          fallback={
            <aside className="w-56 shrink-0 border-r bg-sidebar-background min-h-screen" aria-hidden />
          }
        >
          <AppNav
            initialRole={initialRole}
            onMobileClose={() => setMobileOpen(false)}
          />
        </Suspense>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 bg-background overflow-auto flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 border-b px-4 py-3 bg-sidebar-background shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Atvērt navigāciju"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm text-sidebar-foreground">Command Center</span>
        </div>
        <NoProjectSelected>
          <div className="flex-1 p-6">
            {children}
          </div>
        </NoProjectSelected>
      </main>
    </div>
  )
}
