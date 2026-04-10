"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PROJECT_STORAGE_KEY, type StoredProject } from "@/lib/project-selection"

function readStored(): StoredProject | null {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredProject) : null
  } catch {
    return null
  }
}

/**
 * URL-first project context hook.
 *
 * Priority: ?project_id= URL param → localStorage fallback → null.
 *
 * On mount, if localStorage holds a project but the URL has no project_id,
 * the hook syncs it into the URL via router.replace so server components
 * always receive the correct project context.
 */
export function useProjectContext() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlProjectId = searchParams.get("project_id")
  const [stored, setStored] = useState<StoredProject | null>(null)

  // Hydrate from localStorage on mount and after navigations
  useEffect(() => {
    setStored(readStored())
  }, [pathname, searchParams])

  // URL-first sync: push localStorage project into URL when URL has none
  useEffect(() => {
    if (!urlProjectId && stored?.id) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("project_id", stored.id)
      router.replace(`${pathname}?${params.toString()}`)
    }
    // Only re-run when the core values change, not on every searchParams identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId, stored?.id])

  const projectId = urlProjectId ?? stored?.id ?? null
  const projectName = stored?.name ?? null

  /** Update both localStorage and URL atomically. */
  const setProject = useCallback(
    (id: string | null, name: string) => {
      const next: StoredProject = { id: id ?? null, name }
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(next))
      setStored(next)

      const params = new URLSearchParams(searchParams.toString())
      if (id) {
        params.set("project_id", id)
      } else {
        params.delete("project_id")
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams],
  )

  return { projectId, projectName, setProject }
}
