import { createClient } from "@/lib/supabase/server"
import { SprintsClient, type SimpleTask, type Sprint } from "./sprints-client"

export default async function SprintsPage({ searchParams }: { searchParams?: Promise<{ project_id?: string }> | { project_id?: string } }) {
  const supabase = await createClient()
  const resolvedSearch = await Promise.resolve(searchParams)
  const projectId = typeof resolvedSearch?.project_id === "string" ? resolvedSearch.project_id : null

  const tasksQuery = supabase
    .from("tasks")
    .select("id, title, status, priority, stream_id, streams!inner(name, project_id)")
    .order("created_at", { ascending: false })
  if (projectId) {
    tasksQuery.eq("streams.project_id", projectId)
  }

  const [{ data: sprints }, { data: tasks }] = await Promise.all([
    supabase
      .from("sprints")
      .select(`
        *,
        task_sprint (
          task_id,
          tasks ( id, title, status, priority, assignee_id, stream_id, streams ( project_id ) )
        )
      `)
      .order("start_date", { ascending: false }),
    tasksQuery,
  ])

  const filteredSprints = projectId
    ? ((sprints ?? []).filter((s) =>
        (s.task_sprint ?? []).some(
          (ts: { tasks?: { streams?: { project_id?: string | null } | null } | null }) =>
            ts.tasks?.streams?.project_id === projectId,
        ),
      ) as unknown as Sprint[])
    : ((sprints ?? []) as unknown as Sprint[])

  return (
    <SprintsClient
      initialSprints={filteredSprints}
      allTasks={(tasks ?? []) as unknown as SimpleTask[]}
    />
  )
}
