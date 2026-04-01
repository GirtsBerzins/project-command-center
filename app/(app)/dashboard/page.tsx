import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ActivitySparkline } from "./activity-sparkline"
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Flag, Users } from "lucide-react"

interface Stream {
  id: string; name: string; status: string; progress: number; deadline: string | null
}
interface Risk { impact: "low" | "medium" | "high"; status: string }
interface TaskSprint {
  task_id: string
  sprint_id: string
  tasks: { status?: string; streams?: { project_id?: string | null }[] }[] | { status?: string; streams?: { project_id?: string | null }[] } | null
}
interface ActiveSprint {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  task_sprint: TaskSprint[]
}
interface ActivityLog { created_at: string }

interface DashTaskRow {
  id: string
  assignee_id: string | null
  status: string
  calculated_end_date: string | null
  title: string
}

const STATUS_LV: Record<string, string> = {
  active: "Aktīvs", on_hold: "Aizturēts", completed: "Pabeigts", cancelled: "Atcelts",
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
    cancelled: "bg-gray-100 text-gray-600",
  }
  return map[status] ?? "bg-gray-100 text-gray-600"
}

function buildSparklineData(logs: ActivityLog[]) {
  const counts: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    counts[d.toISOString().slice(0, 10)] = 0
  }
  for (const log of logs) {
    const day = log.created_at.slice(0, 10)
    if (day in counts) counts[day]++
  }
  return Object.entries(counts).map(([date, count]) => ({
    day: new Date(date).toLocaleDateString("lv-LV", { weekday: "short" }),
    count,
  }))
}

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ project_id?: string }> | { project_id?: string } }) {
  const supabase = await createClient()
  const resolvedSearch = await Promise.resolve(searchParams)
  const projectId = typeof resolvedSearch?.project_id === "string" ? resolvedSearch.project_id : null
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const streamsQuery = supabase
    .from("streams")
    .select("id, name, status, progress, deadline, project_id")
    .order("progress", { ascending: false })
  if (projectId) {
    streamsQuery.eq("project_id", projectId)
  }

  const [{ data: streams }, { data: risks }, { data: activeSprints }, { data: activityLogs }] = await Promise.all([
    streamsQuery,
    projectId
      ? Promise.resolve({ data: [] as Risk[] })
      : supabase.from("risks").select("impact, status").eq("status", "open"),
    supabase
      .from("sprints")
      .select(`id, name, status, start_date, end_date, task_sprint ( task_id, sprint_id, tasks ( status, streams ( project_id ) ) )`)
      .eq("status", "active"),
    projectId
      ? Promise.resolve({ data: [] as ActivityLog[] })
      : supabase.from("activity_logs").select("created_at").gte("created_at", sevenDaysAgo.toISOString()).order("created_at"),
  ])

  const streamIds = projectId ? (streams ?? []).map((s) => s.id) : []

  const [{ data: milestoneRows }, { data: projTasks }, { data: projDeps }] = await Promise.all([
    projectId
      ? supabase.from("milestones").select("status").eq("project_id", projectId)
      : Promise.resolve({ data: [] as { status: string }[] }),
    streamIds.length > 0
      ? supabase
          .from("tasks")
          .select("id, assignee_id, status, calculated_end_date, title")
          .in("stream_id", streamIds)
      : Promise.resolve({ data: [] as DashTaskRow[] }),
    streamIds.length > 0
      ? supabase.from("task_dependencies").select("task_id, depends_on_task_id, type")
      : Promise.resolve({ data: [] as { task_id: string; depends_on_task_id: string; type: string }[] }),
  ])

  const taskList = (projTasks ?? []) as DashTaskRow[]
  const depList = projDeps ?? []
  const taskById = new Map(taskList.map((t) => [t.id, t]))

  function isSeqBlocked(taskId: string): boolean {
    const preds = depList.filter((d) => d.task_id === taskId && d.type === "sequential")
    for (const p of preds) {
      const pred = taskById.get(p.depends_on_task_id)
      if (pred && pred.status !== "done") return true
    }
    return false
  }

  const memberIds = new Set<string>()
  for (const t of taskList) {
    if (t.assignee_id) memberIds.add(t.assignee_id)
  }

  const { data: memberProfiles } =
    memberIds.size > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", [...memberIds])
      : { data: [] as { id: string; full_name: string | null }[] }

  const availability = [...memberIds].map((mid) => {
    const mine = taskList.filter((t) => t.assignee_id === mid)
    const active = mine.filter((t) => t.status !== "done")
    const inProgress = mine.filter((t) => t.status === "in_progress").length
    const blocked = active.some((t) => isSeqBlocked(t.id))
    let freeBy: string | null = null
    for (const t of active) {
      const end = t.calculated_end_date
      if (!end) continue
      if (!freeBy || end > freeBy) freeBy = end
    }
    const prof = (memberProfiles ?? []).find((p) => p.id === mid)
    return {
      id: mid,
      name: prof?.full_name ?? mid.slice(0, 8),
      inProgress,
      blocked,
      freeBy,
    }
  })

  const activeSprint = ((activeSprints ?? []) as ActiveSprint[]).find((s) =>
    !projectId
      ? true
      : (s.task_sprint ?? []).some(
          (ts) => {
            const task = Array.isArray(ts.tasks) ? ts.tasks[0] : ts.tasks
            const stream = Array.isArray(task?.streams) ? task.streams[0] : null
            return stream?.project_id === projectId
          },
        ),
  )

  const riskCounts = { high: 0, medium: 0, low: 0 }
  for (const r of risks ?? []) riskCounts[r.impact as keyof typeof riskCounts]++

  const sprintTasks = activeSprint?.task_sprint ?? []
  const totalTasks = sprintTasks.length
  const doneTasks = sprintTasks.filter((ts) => {
    const task = Array.isArray(ts.tasks) ? ts.tasks[0] : ts.tasks
    return task?.status === "done"
  }).length
  const sprintPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const sparklineData = buildSparklineData((activityLogs ?? []) as ActivityLog[])
  const totalActivity = sparklineData.reduce((s, d) => s + d.count, 0)

  const ms = milestoneRows ?? []
  const milestoneReached = ms.filter((m) => m.status === "reached").length
  const milestoneTotal = ms.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vadības panelis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Projekta pārskats — {new Date().toLocaleDateString("lv-LV", { dateStyle: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Riski */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Atvērtie riski
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Augsta</span>
              <Badge variant="destructive">{riskCounts.high}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Vidēja</span>
              <Badge variant="warning">{riskCounts.medium}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Zema</span>
              <Badge variant="secondary">{riskCounts.low}</Badge>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              {(risks ?? []).length} atvērti riski kopā
            </p>
          </CardContent>
        </Card>

        {/* Sprinta veselība */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              Sprinta veselība
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSprint ? (
              <>
                <p className="text-sm font-medium">{activeSprint.name}</p>
                <Progress value={sprintPct} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{doneTasks}/{totalTasks} uzdevumi pabeigti</span>
                  <span>{sprintPct}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Beidzas {new Date(activeSprint.end_date).toLocaleDateString("lv-LV", { dateStyle: "medium" })}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nav aktīva sprinta</p>
            )}
          </CardContent>
        </Card>

        {/* 7 dienu aktivitāte */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              7 dienu aktivitāte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalActivity}</p>
            <p className="text-xs text-muted-foreground mb-2">notikumi šajā nedēļā</p>
            <ActivitySparkline data={sparklineData} />
          </CardContent>
        </Card>

        {projectId && milestoneTotal > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flag className="h-4 w-4 text-violet-500" />
                Atskaišu punktu progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-bold">
                {milestoneReached}/{milestoneTotal}
              </p>
              <Progress value={milestoneTotal > 0 ? Math.round((milestoneReached / milestoneTotal) * 100) : 0} className="h-2" />
              <p className="text-xs text-muted-foreground">sasniegti mērķa punkti šajā projektā</p>
            </CardContent>
          </Card>
        )}
      </div>

      {projectId && availability.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Komandas noslodze
          </h2>
          <Card>
            <CardContent className="pt-4 space-y-3">
              {availability.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <span className="font-medium">{m.name}</span>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                    <span>Procesā: {m.inProgress}</span>
                    {m.blocked && <Badge variant="warning">Bloķēts</Badge>}
                    {m.freeBy && (
                      <span>
                        Brīvs ap ~{new Date(m.freeBy).toLocaleDateString("lv-LV", { dateStyle: "medium" })}
                      </span>
                    )}
                    {!m.freeBy && m.inProgress === 0 && <span>Brīvs</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Straumes progress */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Straumes progress
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(streams ?? []).map((stream: Stream) => (
            <Card key={stream.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{stream.name}</CardTitle>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(stream.status)}`}>
                    {STATUS_LV[stream.status] ?? stream.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={stream.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stream.progress}% pabeigts</span>
                  {stream.deadline && (
                    <span>Termiņš {new Date(stream.deadline).toLocaleDateString("lv-LV", { month: "short", day: "numeric" })}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
