"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Layers,
  CheckSquare,
  Zap,
  BarChart2,
  FileText,
  LogOut,
  FolderKanban,
  Users,
  Settings,
  Flag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { PROJECT_STORAGE_KEY, type StoredProject, updateSelectedProject } from "@/lib/project-selection"
interface NavProject {
  id: string
  name: string
}

const navItems = [
  { href: "/dashboard", label: "Vadības panelis", icon: LayoutDashboard },
  { href: "/projects",  label: "Projekti",        icon: FolderKanban },
  { href: "/team",      label: "Komanda",         icon: Users },
  { href: "/streams",   label: "Straumes",        icon: Layers },
  { href: "/tasks",     label: "Uzdevumi",         icon: CheckSquare },
  { href: "/milestones", label: "Atskaišu punkti", icon: Flag },
  { href: "/sprints",   label: "Sprinti",          icon: Zap },
  { href: "/kpis",      label: "KPI",              icon: BarChart2 },
  { href: "/reports",   label: "Atskaites",        icon: FileText },
]

type Role = "owner" | "manager" | "member" | "viewer"

export function AppNav({ initialRole }: { initialRole?: Role }) {
  const pathname = usePathname()
  const supabase = createClient()
  const [selectedProject] = useState<StoredProject | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as StoredProject) : null
    } catch {
      return null
    }
  })
  const [projects, setProjects] = useState<NavProject[]>([])
  const [myRole, setMyRole] = useState<Role | null>(initialRole ?? null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from("projects").select("id, name").order("created_at", { ascending: false })
      if (!cancelled) setProjects((data ?? []) as NavProject[])
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = "/login"
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
              updateSelectedProject(
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
          <div className="space-y-1">
            {projects.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateSelectedProject({ id: p.id, name: p.name })}
                className={cn(
                  "w-full text-left rounded-md px-2 py-1 text-xs",
                  selectedProject?.id === p.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
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
        {(myRole === "owner" || myRole === "manager") && (
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/settings")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Iestatījumi
          </Link>
        )}
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
