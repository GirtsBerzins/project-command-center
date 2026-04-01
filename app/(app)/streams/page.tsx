import { createClient } from "@/lib/supabase/server"
import { StreamsClient } from "./streams-client"

export default async function StreamsPage({ searchParams }: { searchParams?: Promise<{ project_id?: string }> | { project_id?: string } }) {
  const supabase = await createClient()
  const resolvedSearch = await Promise.resolve(searchParams)
  const projectId = typeof resolvedSearch?.project_id === "string" ? resolvedSearch.project_id : null

  const streamsQuery = supabase
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
    .order("created_at", { ascending: false })
  if (projectId) {
    streamsQuery.eq("project_id", projectId)
  }

  const projectsQuery = supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false })
  if (projectId) {
    projectsQuery.eq("id", projectId)
  }

  const [{ data: streams }, { data: profiles }, { data: projects }, { data: selectedProject }] = await Promise.all([
    streamsQuery,
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name"),
    projectsQuery,
    projectId
      ? supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <StreamsClient
      initialStreams={streams ?? []}
      profiles={profiles ?? []}
      projects={projects ?? []}
      selectedProjectId={projectId}
      selectedProjectName={selectedProject?.name ?? null}
    />
  )
}
