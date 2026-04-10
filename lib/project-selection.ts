export const PROJECT_STORAGE_KEY = "command-center:selected-project"

export interface StoredProject {
  id: string | null
  name: string
}

/** @deprecated Use the setProject function returned by useProjectContext instead. */
export function updateSelectedProject(project: StoredProject | null) {
  if (typeof window === "undefined") return

  if (project) {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project))
  } else {
    window.localStorage.removeItem(PROJECT_STORAGE_KEY)
  }

  const url = new URL(window.location.href)
  if (project?.id) {
    url.searchParams.set("project_id", project.id)
  } else {
    url.searchParams.delete("project_id")
  }
  window.location.href = url.pathname + (url.search ? `?${url.searchParams.toString()}` : "")
}

/**
 * Copies the current page URL with ?project_id= appended (or updated) to the clipboard.
 * Returns a promise that resolves when the text is copied.
 */
export function copyProjectLink(projectId: string): Promise<void> {
  const url = new URL(window.location.href)
  url.searchParams.set("project_id", projectId)
  return navigator.clipboard.writeText(url.toString())
}
