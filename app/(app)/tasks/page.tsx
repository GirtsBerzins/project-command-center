import { createClient } from "@/lib/supabase/server"
import { TasksClient } from "./tasks-client"

export default async function TasksPage({ searchParams }: { searchParams?: Promise<{ project_id?: string }> | { project_id?: string } }) {
  const supabase = await createClient()
  const resolvedSearch = await Promise.resolve(searchParams)
  const projectId = typeof resolvedSearch?.project_id === "string" ? resolvedSearch.project_id : null

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const [{ data: tasks }, { data: streams }, { data: profiles }, { data: me }] = await Promise.all([
    tasksQuery,
    streamsQuery,
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const taskList = tasks ?? []
  const taskIds = taskList.map((t) => t.id)

  const [{ data: depsOut }, { data: depsIn }] = await Promise.all([
    taskIds.length > 0
      ? supabase.from("task_dependencies").select("id, task_id, depends_on_task_id, type").in("task_id", taskIds)
      : Promise.resolve({ data: [] as { id: string; task_id: string; depends_on_task_id: string; type: string }[] }),
    taskIds.length > 0
      ? supabase.from("task_dependencies").select("id, task_id, depends_on_task_id, type").in("depends_on_task_id", taskIds)
      : Promise.resolve({ data: [] as { id: string; task_id: string; depends_on_task_id: string; type: string }[] }),
    projectId
      ? supabase.from("projects").select("id, start_date, name").eq("id", projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const depMap = new Map<string, { id: string; task_id: string; depends_on_task_id: string; type: string }>()
  for (const d of [...(depsOut ?? []), ...(depsIn ?? [])]) {
    depMap.set(d.id, d)
  }
  const initialDependencies = [...depMap.values()]

  const myRole = (me?.role as "owner" | "manager" | "member" | "viewer" | undefined) ?? undefined

  const { data: milestoneRows } = projectId
    ? await supabase.from("milestones").select("id, title, due_date, status").eq("project_id", projectId)
    : { data: [] as { id: string; title: string; due_date: string | null; status: string }[] }

  return (
    <TasksClient
      initialTasks={taskList}
      streams={streams ?? []}
      profiles={profiles ?? []}
      selectedProjectId={projectId}
      initialDependencies={initialDependencies}
      projectStartDate={projectRow?.start_date ?? null}
      myRole={myRole}
      initialMilestones={milestoneRows ?? []}
    />
  )
}
