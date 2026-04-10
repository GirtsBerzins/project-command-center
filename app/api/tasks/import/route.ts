import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeTaskSchedule, type ScheduleDepInput, type ScheduleTaskInput } from "@/lib/task-schedule"

type ImportTaskIn = {
  temp_id: string
  project_name?: string | null
  title: string
  estimate_hours: number
  description?: string | null
  assignee_id?: string | null
  stream_id?: string | null
  stream_name?: string | null
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
    const userId = user?.id ?? null
    if (!userId) {
      return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 })
    }

    // 8.1 — fetch org-level role to know if user can create streams
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
    const canManageStreams = profile?.role === "owner" || profile?.role === "manager"

    const body = (await request.json()) as {
      default_project_id?: string
      tasks?: ImportTaskIn[]
      dependencies?: ImportDepIn[]
    }
    const defaultProjectId = typeof body.default_project_id === "string" ? body.default_project_id : null
    const taskRows = Array.isArray(body.tasks) ? body.tasks : []
    const depRows = Array.isArray(body.dependencies) ? body.dependencies : []

    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Nav importējamo rindu" }, { status: 400 })
    }

    const { data: projects } = await supabase.from("projects").select("id, name, start_date")
    const projectNameToId = new Map<string, string>()
    const projectStartById = new Map<string, string | null>()
    for (const p of projects ?? []) {
      if (p.name?.trim()) {
        projectNameToId.set(p.name.trim().toLowerCase(), p.id)
      }
      projectStartById.set(p.id, p.start_date ?? null)
    }

    const streamsByProject = new Map<string, { ids: Set<string>; nameToId: Map<string, string> }>()
    async function ensureStreamsForProject(projectId: string): Promise<void> {
      if (streamsByProject.has(projectId)) return
      const { data: streams } = await supabase.from("streams").select("id, name").eq("project_id", projectId)
      const ids = new Set<string>()
      const nameToId = new Map<string, string>()
      for (const s of streams ?? []) {
        ids.add(s.id)
        if (s.name?.trim()) {
          nameToId.set(s.name.trim().toLowerCase(), s.id)
        }
      }
      streamsByProject.set(projectId, { ids, nameToId })
    }

    async function ensureProjectIdForRow(row: ImportTaskIn): Promise<string | null> {
      const fromRow = row.project_name?.trim() ?? ""
      if (fromRow) {
        const key = fromRow.toLowerCase()
        const existing = projectNameToId.get(key)
        if (existing) return existing
        const { data: created, error: projectErr } = await supabase
          .from("projects")
          .insert({ name: fromRow, owner_id: userId })
          .select("id, start_date")
          .single()
        if (projectErr || !created) {
          throw new Error(`Neizdevās izveidot projektu "${fromRow}": ${projectErr?.message ?? "nezināma kļūda"}`)
        }
        projectNameToId.set(key, created.id)
        projectStartById.set(created.id, created.start_date ?? null)
        return created.id
      }
      return defaultProjectId
    }

    async function resolveStreamIdForRow(projectId: string, row: ImportTaskIn): Promise<string | null> {
      await ensureStreamsForProject(projectId)
      const cache = streamsByProject.get(projectId)!
      if (row.stream_id && cache.ids.has(row.stream_id)) {
        return row.stream_id
      }
      const streamName = row.stream_name?.trim() ?? ""
      if (!streamName) return null
      const key = streamName.toLowerCase()
      const existing = cache.nameToId.get(key)
      if (existing) return existing

      // 8.2 — block members/viewers before hitting RLS
      if (!canManageStreams) {
        throw new Error(
          `Nav tiesību izveidot jaunu straumi "${streamName}". ` +
          "Lūdzu izveidojiet straumi manuāli sadaļā Straumes un atkārtojiet importu.",
        )
      }

      // 8.3 — use admin client so stream INSERT bypasses RLS edge-cases for owner/manager
      const admin = createAdminClient()
      const { data: createdStream, error: streamErr } = await admin
        .from("streams")
        .insert({
          name: streamName,
          project_id: projectId,
          owner_id: userId,
        })
        .select("id")
        .single()
      if (streamErr || !createdStream) {
        throw new Error(`Neizdevās izveidot straumi "${streamName}": ${streamErr?.message ?? "nezināma kļūda"}`)
      }
      cache.ids.add(createdStream.id)
      cache.nameToId.set(key, createdStream.id)
      return createdStream.id
    }

    const tempToReal = new Map<string, string>()
    const affectedProjectIds = new Set<string>()

    for (const row of taskRows) {
      if (!row.title?.trim() || row.estimate_hours == null || Number.isNaN(Number(row.estimate_hours))) {
        return NextResponse.json({ error: `Nederīga rinda: ${row.temp_id}` }, { status: 400 })
      }
      let projectId: string | null = null
      try {
        projectId = await ensureProjectIdForRow(row)
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 })
      }
      if (!projectId) {
        return NextResponse.json(
          {
            error:
              `Rindai ${row.temp_id} nav noteikts projekts. ` +
              "Atlasiet projektu sānjoslā vai aizpildiet kolonu 'project'.",
          },
          { status: 400 },
        )
      }
      affectedProjectIds.add(projectId)
      let streamId: string | null = null
      try {
        streamId = await resolveStreamIdForRow(projectId, row)
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 })
      }
      const priority = ALLOWED_PRIORITY.has(row.priority ?? "") ? row.priority! : "medium"
      const status = ALLOWED_STATUS.has(row.status ?? "") ? row.status! : "todo"

      const { data: inserted, error: insErr } = await supabase
        .from("tasks")
        .insert({
          title: row.title.trim(),
          description: row.description?.trim() ? row.description.trim() : null,
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

    const { data: allDeps } = await supabase.from("task_dependencies").select("task_id, depends_on_task_id, type")
    for (const projectId of affectedProjectIds) {
      await ensureStreamsForProject(projectId)
      const streamIds = [...(streamsByProject.get(projectId)?.ids ?? [])]
      if (streamIds.length === 0) continue

      const { data: taskList } = await supabase
        .from("tasks")
        .select("id, estimate_hours, start_date, due_date, manual_override, stream_id")
        .in("stream_id", streamIds)

      const tasks = (taskList ?? []) as ScheduleTaskInput[]
      const taskIds = new Set(tasks.map((t) => t.id))
      const dependencies = (allDeps ?? []).filter(
        (x) => taskIds.has(x.task_id) && taskIds.has(x.depends_on_task_id),
      ) as ScheduleDepInput[]

      const today = new Date()
      const projectStart =
        projectStartById.get(projectId) ??
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
