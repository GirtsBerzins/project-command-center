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
  ChevronDown,
  ClipboardList,
  TrendingUp,
  X,
  Link2,
  Check,
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
import { useEffect, useMemo, useState } from "react"
import { useProjectContext } from "@/hooks/use-project-context"
import { copyProjectLink } from "@/lib/project-selection"

interface NavProject {
  id: string
  name: string
}

const topNavItems = [
  { href: "/dashboard", label: "Vadības panelis", icon: LayoutDashboard },
  { href: "/projects",  label: "Projekti",        icon: FolderKanban },
  { href: "/team",      label: "Komanda",         icon: Users },
]

const planningItems = [
  { href: "/streams",    label: "Straumes",        icon: Layers },
  { href: "/tasks",      label: "Uzdevumi",        icon: CheckSquare },
  { href: "/milestones", label: "Atskaišu punkti", icon: Flag },
]

const analyticsItems = [
  { href: "/kpis",     label: "KPI",       icon: BarChart2 },
  { href: "/reports",  label: "Atskaites", icon: FileText },
]

const bottomNavItems = [
  { href: "/sprints", label: "Sprinti", icon: Zap },
]

type Role = "owner" | "manager" | "member" | "viewer"

/** Pievieno ?project_id=… ja atlasīts konkrēts projekts (saglabā kontekstu starp lapām). */
function hrefWithProject(base: string, projectId: string | null): string {
  if (!projectId) return base
  const sep = base.includes("?") ? "&" : "?"
  return `${base}${sep}project_id=${encodeURIComponent(projectId)}`
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  indent = false,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  indent?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        indent && "pl-8",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

export function AppNav({ initialRole, onMobileClose }: { initialRole?: Role; onMobileClose?: () => void }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const { projectId: activeProjectId, projectName, setProject } = useProjectContext()

  const [projects, setProjects] = useState<NavProject[]>([])
  const [myRole] = useState<Role | null>(initialRole ?? null)
  const [copied, setCopied] = useState(false)

  const isPlanningActive = planningItems.some((item) => pathname.startsWith(item.href))
  const [planningOpen, setPlanningOpen] = useState(isPlanningActive)

  useEffect(() => {
    if (isPlanningActive) setPlanningOpen(true)
  }, [isPlanningActive])

  const isAnalyticsActive = analyticsItems.some((item) => pathname.startsWith(item.href))
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsActive)

  useEffect(() => {
    if (isAnalyticsActive) setAnalyticsOpen(true)
  }, [isAnalyticsActive])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from("projects").select("id, name").order("created_at", { ascending: false }).limit(50)
      if (!cancelled) setProjects((data ?? []) as NavProject[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const displayProjectName =
    activeProjectId == null
      ? "Visi projekti"
      : (projects.find((p) => p.id === activeProjectId)?.name ?? projectName ?? "Projekts")

  function handleCopyLink() {
    if (!activeProjectId) return
    copyProjectLink(activeProjectId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <aside className="w-56 shrink-0 border-r bg-sidebar-background min-h-screen h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-sm tracking-tight text-sidebar-foreground">
            Command Center
          </h1>
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              className="lg:hidden rounded-md p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              aria-label="Aizvērt navigāciju"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-[11px] font-medium text-sidebar-foreground/70 uppercase tracking-wide">
            Projekts
          </p>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex-1 flex items-center justify-between gap-1 rounded-md border px-2.5 py-1.5 text-xs",
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
                      setProject(null, "Visi projekti")
                      return
                    }
                    const proj = projects.find((p) => p.id === v)
                    if (proj) setProject(proj.id, proj.name)
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

            {/* Share button — copies current URL with ?project_id= */}
            {activeProjectId && (
              <button
                type="button"
                onClick={handleCopyLink}
                title={copied ? "Nokopēts!" : "Kopēt saiti"}
                className={cn(
                  "shrink-0 rounded-md p-1.5 transition-colors",
                  copied
                    ? "text-green-600 bg-green-50"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                )}
                aria-label="Kopēt projekta saiti"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {topNavItems.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={hrefWithProject(href, activeProjectId)}
            label={label}
            icon={icon}
            active={pathname.startsWith(href)}
          />
        ))}

        {/* Planning dropdown */}
        <button
          type="button"
          onClick={() => setPlanningOpen((o) => !o)}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isPlanningActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Plānošana</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition-transform", planningOpen && "rotate-180")}
          />
        </button>
        {planningOpen && (
          <div className="space-y-0.5">
            {planningItems.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={hrefWithProject(href, activeProjectId)}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
                indent
              />
            ))}
          </div>
        )}

        {bottomNavItems.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={hrefWithProject(href, activeProjectId)}
            label={label}
            icon={icon}
            active={pathname.startsWith(href)}
          />
        ))}

        {/* Analytics dropdown */}
        <button
          type="button"
          onClick={() => setAnalyticsOpen((o) => !o)}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isAnalyticsActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <TrendingUp className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Analītika</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition-transform", analyticsOpen && "rotate-180")}
          />
        </button>
        {analyticsOpen && (
          <div className="space-y-0.5">
            {analyticsItems.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={hrefWithProject(href, activeProjectId)}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
                indent
              />
            ))}
          </div>
        )}

        {(myRole === "owner" || myRole === "manager") && (
          <NavLink
            href={hrefWithProject("/settings", activeProjectId)}
            label="Iestatījumi"
            icon={Settings}
            active={pathname.startsWith("/settings")}
          />
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
