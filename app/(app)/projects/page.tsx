import { createClient } from "@/lib/supabase/server"
import { ProjectsClient } from "./projects-client"

export default async function ProjectsPage() {
  const supabase = await createClient()

  const [{ data: projects }, { data: profiles }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `
        *,
        profiles:owner_id ( id, full_name ),
        milestones ( id, status, weight_percent, due_date, completed_at )
      `,
      )
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ])

  return (
    <ProjectsClient
      initialProjects={(projects ?? []) as any}
      profiles={profiles ?? []}
    />
  )
}

