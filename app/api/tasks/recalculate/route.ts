import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computeTaskSchedule, type ScheduleDepInput, type ScheduleTaskInput } from "@/lib/task-schedule"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 })
    }

    const body = (await request.json()) as { project_id?: string }
    const projectId = typeof body.project_id === "string" ? body.project_id : null
    if (!projectId) {
      return NextResponse.json({ error: "Trūkst project_id" }, { status: 400 })
    }

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, start_date")
      .eq("id", projectId)
      .maybeSingle()
    if (pErr || !project) {
      return NextResponse.json({ error: pErr?.message ?? "Projekts nav atrasts" }, { status: 404 })
    }

    const { data: streams, error: sErr } = await supabase
      .from("streams")
      .select("id")
      .eq("project_id", projectId)
    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 400 })
    }
    const streamIds = (streams ?? []).map((s) => s.id)
    if (streamIds.length === 0) {
      return NextResponse.json({ updates: {}, criticalPathIds: [] })
    }

    const { data: taskRows, error: tErr } = await supabase
      .from("tasks")
      .select("id, estimate_hours, start_date, due_date, manual_override, stream_id")
      .in("stream_id", streamIds)
    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 400 })
    }

    const tasks = (taskRows ?? []) as ScheduleTaskInput[]
    const taskIds = new Set(tasks.map((t) => t.id))
    if (taskIds.size === 0) {
      return NextResponse.json({ updates: {}, criticalPathIds: [] })
    }

    const { data: depRows, error: dErr } = await supabase.from("task_dependencies").select("task_id, depends_on_task_id, type")
    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 400 })
    }

    const dependencies = (depRows ?? []).filter(
      (d) => taskIds.has(d.task_id) && taskIds.has(d.depends_on_task_id),
    ) as ScheduleDepInput[]

    const today = new Date()
    const projectStart =
      project.start_date ??
      `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`

    const { updates, criticalPathIds } = computeTaskSchedule({
      projectStart,
      tasks,
      dependencies,
    })

    for (const id of Object.keys(updates)) {
      const u = updates[id]
      const { error: upErr } = await supabase
        .from("tasks")
        .update({
          calculated_start_date: u.calculated_start_date,
          calculated_end_date: u.calculated_end_date,
        })
        .eq("id", id)
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 })
      }
    }

    return NextResponse.json({ updates, criticalPathIds })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
