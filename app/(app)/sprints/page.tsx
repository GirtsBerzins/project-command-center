import { createClient } from "@/lib/supabase/server"
import { SprintsClient, type SimpleTask, type Sprint } from "./sprints-client"

export default async function SprintsPage() {
  const supabase = await createClient()

  const [{ data: sprints }, { data: tasks }] = await Promise.all([
    supabase
      .from("sprints")
      .select(`
        *,
        task_sprint (
          task_id,
          tasks ( id, title, status, priority, assignee_id )
        )
      `)
      .order("start_date", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, status, priority, stream_id, streams!inner(name)")
      .order("created_at", { ascending: false }),
  ])

  return (
    <SprintsClient
      initialSprints={(sprints ?? []) as unknown as Sprint[]}
      allTasks={(tasks ?? []) as unknown as SimpleTask[]}
    />
  )
}
