import { createClient } from "@/lib/supabase/server"
import { KpisClient } from "./kpis-client"

export default async function KpisPage({ searchParams }: { searchParams?: Promise<{ project_id?: string }> | { project_id?: string } }) {
  const supabase = await createClient()
  const resolvedSearch = await Promise.resolve(searchParams)
  const projectId = typeof resolvedSearch?.project_id === "string" ? resolvedSearch.project_id : null

  const kpisQuery = supabase
    .from("kpis")
    .select(`
        *,
        profiles(id, full_name, email),
        kpi_values ( id, value, recorded_at )
      `)
    .order("created_at", { ascending: false })
  if (projectId) {
    kpisQuery.eq("project_id", projectId)
  }

  const [{ data: kpis }, { data: profiles }, { data: selectedProject }] = await Promise.all([
    kpisQuery,
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name"),
    projectId
      ? supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Sort kpi_values by recorded_at for each KPI
  const kpisWithSortedValues = (kpis ?? []).map((k) => ({
    ...k,
    kpi_values: [...(k.kpi_values ?? [])].sort(
      (a: { recorded_at: string }, b: { recorded_at: string }) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    ),
  }))

  return (
    <KpisClient
      initialKpis={kpisWithSortedValues}
      profiles={profiles ?? []}
      selectedProjectId={projectId}
      selectedProjectName={selectedProject?.name ?? null}
    />
  )
}
