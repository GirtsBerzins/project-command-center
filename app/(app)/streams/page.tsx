import { createClient } from "@/lib/supabase/server"
import { StreamsClient } from "./streams-client"

export default async function StreamsPage() {
  const supabase = await createClient()

  const [{ data: streams }, { data: profiles }, { data: projects }] = await Promise.all([
    supabase
      .from("streams")
      .select(`
        *,
        profiles(id, full_name),
        projects:project_id ( id, name ),
        sprint_streams (
          sprints (
            id,
            name,
            status
          )
        )
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name"),
    supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: false }),
  ])

  return (
    <StreamsClient
      initialStreams={streams ?? []}
      profiles={profiles ?? []}
      projects={projects ?? []}
    />
  )
}
