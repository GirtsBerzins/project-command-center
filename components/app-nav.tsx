"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
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
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function readStoredProject(): StoredProject | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredProject) : null
  } catch {
    return null
  }
}

/** Pievieno ?project_id=… ja atlasīts konkrēts projekts (saglabā kontekstu starp lapām). */
function hrefWithProject(base: string, projectId: string | null): string {
  if (!projectId) return base
  const sep = base.includes("?") ? "&" : "?"
  return `${base}${sep}project_id=${encodeURIComponent(projectId)}`
}

export function AppNav({ initialRole }: { initialRole?: Role }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const urlProjectId = searchParams.get("project_id")
  const supabase = createClient()

  const [storedProject, setStoredProject] = useState<StoredProject | null>(null)
  const [projects, setProjects] = useState<NavProject[]>([])
  const [myRole] = useState<Role | null>(initialRole ?? null)

  useEffect(() => {
    setStoredProject(readStoredProject())
  }, [pathname, searchKey])

  const activeProjectId = urlProjectId ?? storedProject?.id ?? null

  const displayProjectName =
    activeProjectId == null
      ? (storedProject?.name ?? "Visi projekti")
      : (projects.find((p) => p.id === activeProjectId)?.name ??
        (storedProject?.id === activeProjectId ? storedProject.name : null) ??
        "Projekts")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from("projects").select("id, name").order("created_at", { ascending: false }).limit(50)
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center justify-between gap-1 rounded-md border px-2.5 py-1.5 text-xs",
                  "bg-sidebar-background text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-sidebar-background",
                )}
              >
                <span className="truncate text-left">{displayProjectName}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[12rem] max-h-[min(70vh,18rem)] overflow-y-auto"
            >
              <DropdownMenuRadioGroup
                value={activeProjectId ?? "__all__"}
                onValueChange={(v) => {
                  if (v === "__all__") {
                    updateSelectedProject({ id: null, name: "Visi projekti" })
                    return
                  }
                  const proj = projects.find((p) => p.id === v)
                  if (proj) updateSelectedProject({ id: proj.id, name: proj.name })
                }}
              >
                <DropdownMenuRadioItem value="__all__" className="text-xs">
                  Visi projekti
                </DropdownMenuRadioItem>
                {projects.map((p) => (
                  <DropdownMenuRadioItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={hrefWithProject(href, activeProjectId)}
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
            href={hrefWithProject("/settings", activeProjectId)}
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
