import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computeTaskSchedule, type ScheduleDepInput, type ScheduleTaskInput } from "@/lib/task-schedule"

type ImportTaskIn = {
  temp_id: string
  title: string
  estimate_hours: number
  assignee_id?: string | null
  stream_id?: string | null
  priority?: string
  status?: string
  start_date?: string | null
  due_date?: string | null
  manual_override?: boolean
}

type ImportDepIn = {
  task_temp_id: string
  type: "sequential" | "parallel"
  predecessor_temp_id?: string | null
  predecessor_task_id?: string | null
}

const ALLOWED_PRIORITY = new Set(["low", "medium", "high", "critical"])
const ALLOWED_STATUS = new Set(["todo", "in_progress", "review", "done"])

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 })
    }

    const body = (await request.json()) as {
      project_id?: string
      tasks?: ImportTaskIn[]
      dependencies?: ImportDepIn[]
    }
    const projectId = typeof body.project_id === "string" ? body.project_id : null
    const taskRows = Array.isArray(body.tasks) ? body.tasks : []
    const depRows = Array.isArray(body.dependencies) ? body.dependencies : []

    if (!projectId) {
      return NextResponse.json({ error: "Trūkst project_id" }, { status: 400 })
    }
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Nav importējamo rindu" }, { status: 400 })
    }

    const { data: streams } = await supabase.from("streams").select("id").eq("project_id", projectId)
    const streamIds = new Set((streams ?? []).map((s) => s.id))

    const tempToReal = new Map<string, string>()

    for (const row of taskRows) {
      if (!row.title?.trim() || row.estimate_hours == null || Number.isNaN(Number(row.estimate_hours))) {
        return NextResponse.json({ error: `Nederīga rinda: ${row.temp_id}` }, { status: 400 })
      }
      const streamId = row.stream_id && streamIds.has(row.stream_id) ? row.stream_id : null
      const priority = ALLOWED_PRIORITY.has(row.priority ?? "") ? row.priority! : "medium"
      const status = ALLOWED_STATUS.has(row.status ?? "") ? row.status! : "todo"

      const { data: inserted, error: insErr } = await supabase
        .from("tasks")
        .insert({
          title: row.title.trim(),
          stream_id: streamId,
          assignee_id: row.assignee_id ?? null,
          priority,
          status,
          estimate_hours: Number(row.estimate_hours),
          start_date: row.start_date ?? null,
          due_date: row.due_date ?? null,
          manual_override: row.manual_override ?? false,
        })
        .select("id")
        .single()

      if (insErr || !inserted) {
        return NextResponse.json({ error: insErr?.message ?? "Neizdevās ievietot uzdevumu" }, { status: 400 })
      }
      tempToReal.set(row.temp_id, inserted.id)
    }

    const dbDeps: { task_id: string; depends_on_task_id: string; type: "sequential" | "parallel" }[] = []

    for (const d of depRows) {
      const taskId = tempToReal.get(d.task_temp_id)
      if (!taskId) continue
      let pred: string | undefined
      if (d.predecessor_task_id) {
        pred = d.predecessor_task_id
      } else if (d.predecessor_temp_id) {
        pred = tempToReal.get(d.predecessor_temp_id)
      }
      if (!pred || pred === taskId) continue
      dbDeps.push({ task_id: taskId, depends_on_task_id: pred, type: d.type })
    }

    if (dbDeps.length > 0) {
      const { error: depErr } = await supabase.from("task_dependencies").insert(dbDeps)
      if (depErr) {
        return NextResponse.json({ error: depErr.message }, { status: 400 })
      }
    }

    const { data: project } = await supabase
      .from("projects")
      .select("start_date")
      .eq("id", projectId)
      .maybeSingle()

    if (streamIds.size > 0) {
      const { data: taskList } = await supabase
        .from("tasks")
        .select("id, estimate_hours, start_date, due_date, manual_override, stream_id")
        .in("stream_id", [...streamIds])

      const tasks = (taskList ?? []) as ScheduleTaskInput[]
      const taskIds = new Set(tasks.map((t) => t.id))
      const { data: allDeps } = await supabase.from("task_dependencies").select("task_id, depends_on_task_id, type")
      const dependencies = (allDeps ?? []).filter(
        (x) => taskIds.has(x.task_id) && taskIds.has(x.depends_on_task_id),
      ) as ScheduleDepInput[]

      const today = new Date()
      const projectStart =
        project?.start_date ??
        `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`

      const { updates } = computeTaskSchedule({ projectStart, tasks, dependencies })

      for (const id of Object.keys(updates)) {
        const u = updates[id]
        await supabase
          .from("tasks")
          .update({
            calculated_start_date: u.calculated_start_date,
            calculated_end_date: u.calculated_end_date,
          })
          .eq("id", id)
      }
    }

    return NextResponse.json({ imported: taskRows.length, task_ids: [...tempToReal.values()] })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
