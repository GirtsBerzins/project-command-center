import { createClient } from "@/lib/supabase/server"
import { ReportsClient } from "./reports-client"

type SearchParams = { project_id?: string }

export default async function ReportsPage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const supabase = await createClient()
  const resolvedSearch = await Promise.resolve(searchParams)
  const projectId = typeof resolvedSearch?.project_id === "string" ? resolvedSearch.project_id : null

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const completedTasksQuery = supabase
    .from("tasks")
    .select("id, title, assignee_id, stream_id, profiles(full_name), streams!inner(name, project_id)")
    .eq("status", "done")
    .gte("due_date", weekStart.toISOString().slice(0, 10))
  const delayedTasksQuery = supabase
    .from("tasks")
    .select("id, title, due_date, priority, assignee_id, profiles(full_name), streams!inner(name, project_id), stream_id")
    .neq("status", "done")
    .lt("due_date", new Date().toISOString().slice(0, 10))
    .not("due_date", "is", null)
    .order("due_date")
  if (projectId) {
    completedTasksQuery.eq("streams.project_id", projectId)
    delayedTasksQuery.eq("streams.project_id", projectId)
  }

  const [
    { data: completedTasks },
    { data: delayedTasks },
    { data: openRisks },
    { data: activeSprints },
    { data: savedReports },
    { data: selectedProject },
  ] = await Promise.all([
    completedTasksQuery,

    delayedTasksQuery,

    // Open high risks
    supabase
      .from("risks")
      .select("id, title, impact, probability, status, due_date")
      .eq("status", "open")
      .order("impact"),

    // Active sprint
    supabase
      .from("sprints")
      .select(`id, name, end_date, task_sprint(tasks(status, streams(project_id)))`)
      .eq("status", "active")
      .order("end_date", { ascending: true }),

    // Previously saved reports
    supabase
      .from("weekly_reports")
      .select("id, week_start, week_end, content_md, created_at")
      .order("week_start", { ascending: false })
      .limit(10),
    projectId
      ? supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const activeSprint =
    projectId
      ? (activeSprints ?? []).find((s: any) =>
          (s.task_sprint ?? []).some((ts: any) => ts.tasks?.streams?.project_id === projectId),
        ) ?? null
      : (activeSprints ?? [])[0] ?? null

  return (
    <ReportsClient
      completedTasks={(completedTasks ?? []) as any[]}
      delayedTasks={(delayedTasks ?? []) as any[]}
      openRisks={openRisks ?? []}
      activeSprint={(activeSprint as any) ?? null}
      savedReports={savedReports ?? []}
      weekStart={weekStart.toISOString().slice(0, 10)}
      weekEnd={weekEnd.toISOString().slice(0, 10)}
      selectedProjectName={selectedProject?.name ?? null}
    />
  )
}
