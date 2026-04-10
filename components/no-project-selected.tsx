"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { FolderKanban, ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PROJECT_STORAGE_KEY, type StoredProject } from "@/lib/project-selection"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Routes where a project selection is required to show meaningful data. */
const DATA_ROUTES = [
  "/dashboard",
  "/tasks",
  "/streams",
  "/milestones",
  "/kpis",
  "/reports",
  "/sprints",
]

interface Project {
  id: string
  name: string
}

function readStoredId(): string | null {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    const stored = raw ? (JSON.parse(raw) as StoredProject) : null
    return stored?.id ?? null
  } catch {
    return null
  }
}

/**
 * Wraps page content and replaces it with a project picker when the user
 * is on a data route but has no project selected (neither in URL nor localStorage).
 *
 * Does NOT use useSearchParams so it requires no extra Suspense boundary.
 */
export function NoProjectSelected({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined) // undefined = loading
  const [projects, setProjects] = useState<Project[]>([])

  // Check URL + localStorage on mount / navigation
  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get("project_id")
    const storedId = readStoredId()
    setProjectId(urlId ?? storedId ?? null)
  }, [pathname])

  // Lazy-load project list only when picker is visible
  const needsProject = DATA_ROUTES.some((r) => pathname.startsWith(r))
  const showPicker = needsProject && projectId === null

  useEffect(() => {
    if (!showPicker) return
    supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setProjects((data ?? []) as Project[]))
  }, [showPicker])

  function handleSelect(id: string) {
    const proj = projects.find((p) => p.id === id)
    if (!proj) return

    // Update localStorage
    const next: StoredProject = { id, name: proj.name }
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(next))

    // Navigate to same route with project_id in URL
    const params = new URLSearchParams(window.location.search)
    params.set("project_id", id)
    window.location.href = `${pathname}?${params.toString()}`
  }

  // While determining state, render children (server-rendered content visible)
  if (projectId === undefined) return <>{children}</>

  // On a data route with no project: show picker instead of content
  if (showPicker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="rounded-full bg-muted p-4">
          <FolderKanban className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Izvēlies projektu</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Lai skatītu datus, lūdzu izvēlies projektu no saraksta vai sānjoslas.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={cn("w-56 justify-between")}>
              <span className="truncate">Izvēlies projektu…</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-72 overflow-y-auto">
            <DropdownMenuRadioGroup value="" onValueChange={handleSelect}>
              {projects.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Nav projektu…
                </div>
              ) : (
                projects.map((p) => (
                  <DropdownMenuRadioItem key={p.id} value={p.id} className="text-sm">
                    {p.name}
                  </DropdownMenuRadioItem>
                ))
              )}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  // Project is selected (or route doesn't require one): show normal content
  return <>{children}</>
}
