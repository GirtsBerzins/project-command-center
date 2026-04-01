import { createClient } from "@/lib/supabase/server"
import { TasksClient } from "./tasks-client"

export default async function TasksPage({ searchParams }: { searchParams?: Promise<{ project_id?: string }> | { project_id?: string } }) {
  const supabase = await createClient()
  const resolvedSearch = await Promise.resolve(searchParams)
  const projectId = typeof resolvedSearch?.project_id === "string" ? resolvedSearch.project_id : null

  const tasksQuery = supabase
    .from("tasks")
    .select("*, profiles(id, full_name, email), streams!inner(id, name, project_id)")
    .order("created_at", { ascending: false })
  const streamsQuery = supabase
    .from("streams")
    .select("id, name, project_id")
    .eq("status", "active")
    .order("name")

  if (projectId) {
    tasksQuery.eq("streams.project_id", projectId)
    streamsQuery.eq("project_id", projectId)
  }

  const [{ data: tasks }, { data: streams }, { data: profiles }] = await Promise.all([
    tasksQuery,
    streamsQuery,
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name"),
  ])

  return (
    <TasksClient
      initialTasks={tasks ?? []}
      streams={streams ?? []}
      profiles={profiles ?? []}
      selectedProjectId={projectId}
    />
  )
}
