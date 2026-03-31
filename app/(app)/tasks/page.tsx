import { createClient } from "@/lib/supabase/server"
import { TasksClient } from "./tasks-client"

export default async function TasksPage() {
  const supabase = await createClient()

  const [{ data: tasks }, { data: streams }, { data: profiles }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, profiles(id, full_name, email), streams(id, name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("streams")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
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
    />
  )
}
