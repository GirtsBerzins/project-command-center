import { createClient } from "@/lib/supabase/server"
import { StreamsClient } from "./streams-client"

export default async function StreamsPage() {
  const supabase = await createClient()

  const [{ data: streams }, { data: profiles }] = await Promise.all([
    supabase
      .from("streams")
      .select("*, profiles(id, full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name"),
  ])

  return (
    <StreamsClient
      initialStreams={streams ?? []}
      profiles={profiles ?? []}
    />
  )
}
