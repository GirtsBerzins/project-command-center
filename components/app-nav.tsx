"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Layers, CheckSquare, Zap, BarChart2, FileText, LogOut, FolderKanban } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

const PROJECT_STORAGE_KEY = "command-center:selected-project"

interface StoredProject {
  id: string | null
  name: string
}

const navItems = [
  { href: "/dashboard", label: "Vadības panelis", icon: LayoutDashboard },
  { href: "/projects",  label: "Projekti",        icon: FolderKanban },
  { href: "/streams",   label: "Straumes",        icon: Layers },
  { href: "/tasks",     label: "Uzdevumi",         icon: CheckSquare },
  { href: "/sprints",   label: "Sprinti",          icon: Zap },
  { href: "/kpis",      label: "KPI",              icon: BarChart2 },
  { href: "/reports",   label: "Atskaites",        icon: FileText },
]

export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [selectedProject, setSelectedProject] = useState<StoredProject | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredProject
        setSelectedProject(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  function updateProject(project: StoredProject | null) {
    setSelectedProject(project)
    if (typeof window !== "undefined") {
      if (project) {
        window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project))
      } else {
        window.localStorage.removeItem(PROJECT_STORAGE_KEY)
      }
    }
    const url = new URL(window.location.href)
    if (project?.id) {
      url.searchParams.set("project_id", project.id)
    } else {
      url.searchParams.delete("project_id")
    }
    router.push(url.pathname + (url.search ? `?${url.searchParams.toString()}` : ""))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-56 shrink-0 border-r bg-sidebar-background min-h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="font-bold text-sm tracking-tight text-sidebar-foreground">
          Command Center
        </h1>
        <div className="mt-3 space-y-1">
          <p className="text-[11px] font-medium text-sidebar-foreground/70 uppercase tracking-wide">
            Projekts
          </p>
          <button
            type="button"
            onClick={() =>
              updateProject(
                selectedProject && selectedProject.id === null ? null : { id: null, name: "Visi projekti" },
              )
            }
            className={cn(
              "w-full flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs",
              "bg-sidebar-background text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            )}
          >
            <span className="truncate">
              {selectedProject?.id
                ? selectedProject.name
                : selectedProject?.name ?? "Visi projekti"}
            </span>
          </button>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Iziet
        </Button>
      </div>
    </aside>
  )
}
