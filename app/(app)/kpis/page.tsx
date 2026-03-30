import { createClient } from "@/lib/supabase/server"
import { KpisClient } from "./kpis-client"

export default async function KpisPage() {
  const supabase = await createClient()

  const [{ data: kpis }, { data: profiles }] = await Promise.all([
    supabase
      .from("kpis")
      .select(`
        *,
        profiles(id, full_name),
        kpi_values ( id, value, recorded_at )
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name"),
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
    />
  )
}
