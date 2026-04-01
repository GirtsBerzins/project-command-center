import { createClient } from "@/lib/supabase/server"
import { MilestonesClient } from "./milestones-client"

export default async function MilestonesPage({
  searchParams,
}: {
  searchParams?: Promise<{ project_id?: string }> | { project_id?: string }
}) {
  const supabase = await createClient()
  const resolved = await Promise.resolve(searchParams)
  const projectId = typeof resolved?.project_id === "string" ? resolved.project_id : null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = me?.role as string | undefined

  if (projectId && role && ["owner", "manager"].includes(role)) {
    const today = new Date().toISOString().slice(0, 10)
    await supabase
      .from("milestones")
      .update({ status: "missed" })
      .eq("project_id", projectId)
      .eq("status", "planned")
      .not("due_date", "is", null)
      .lt("due_date", today)
  }

  let milestonesQuery = supabase
    .from("milestones")
    .select("id, project_id, stream_id, title, description, weight_percent, status, due_date, completed_at, created_at")
    .order("due_date", { ascending: true, nullsFirst: false })

  if (projectId) milestonesQuery = milestonesQuery.eq("project_id", projectId)

  const [{ data: milestones }, { data: projects }, { data: streamsForProject }] = await Promise.all([
    milestonesQuery,
    supabase.from("projects").select("id, name").order("name"),
    projectId ? supabase.from("streams").select("id").eq("project_id", projectId) : Promise.resolve({ data: [] as { id: string }[] }),
  ])

  const streamIds = (streamsForProject ?? []).map((s) => s.id)
  const { data: tasks } =
    streamIds.length > 0
      ? await supabase.from("tasks").select("id, title, status").in("stream_id", streamIds)
      : { data: [] as { id: string; title: string; status: string }[] }

  const { data: links } =
    milestones && milestones.length > 0
      ? await supabase
          .from("milestone_tasks")
          .select("milestone_id, task_id")
          .in(
            "milestone_id",
            milestones.map((m) => m.id),
          )
      : { data: [] as { milestone_id: string; task_id: string }[] }

  return (
    <MilestonesClient
      initialMilestones={milestones ?? []}
      projectId={projectId}
      projects={projects ?? []}
      tasks={(tasks ?? []) as { id: string; title: string; status: string }[]}
      links={links ?? []}
      myRole={role as "owner" | "manager" | "member" | "viewer" | undefined}
    />
  )
}
