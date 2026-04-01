export const PROJECT_STORAGE_KEY = "command-center:selected-project"

export interface StoredProject {
  id: string | null
  name: string
}

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
