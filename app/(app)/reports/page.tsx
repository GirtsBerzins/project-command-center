import { createClient } from "@/lib/supabase/server"
import { ReportsClient } from "./reports-client"

export default async function ReportsPage() {
  const supabase = await createClient()

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const [
    { data: completedTasks },
    { data: delayedTasks },
    { data: openRisks },
    { data: activeSprint },
    { data: savedReports },
  ] = await Promise.all([
    // Tasks completed this week
    supabase
      .from("tasks")
      .select("id, title, assignee_id, stream_id, profiles(full_name), streams(name)")
      .eq("status", "done")
      .gte("due_date", weekStart.toISOString().slice(0, 10)),

    // Overdue tasks (not done, due before today)
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, assignee_id, profiles(full_name), streams(name), stream_id")
      .neq("status", "done")
      .lt("due_date", new Date().toISOString().slice(0, 10))
      .not("due_date", "is", null)
      .order("due_date"),

    // Open high risks
    supabase
      .from("risks")
      .select("id, title, impact, probability, status, due_date")
      .eq("status", "open")
      .order("impact"),

    // Active sprint
    supabase
      .from("sprints")
      .select(`id, name, end_date, task_sprint(tasks(status))`)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),

    // Previously saved reports
    supabase
      .from("weekly_reports")
      .select("id, week_start, week_end, content_md, created_at")
      .order("week_start", { ascending: false })
      .limit(10),
  ])

  return (
    <ReportsClient
      completedTasks={(completedTasks ?? []) as any[]}
      delayedTasks={(delayedTasks ?? []) as any[]}
      openRisks={openRisks ?? []}
      activeSprint={(activeSprint as any) ?? null}
      savedReports={savedReports ?? []}
      weekStart={weekStart.toISOString().slice(0, 10)}
      weekEnd={weekEnd.toISOString().slice(0, 10)}
    />
  )
}
