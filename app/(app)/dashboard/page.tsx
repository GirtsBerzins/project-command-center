import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ActivitySparkline } from "./activity-sparkline"
import { CheckCircle2, Clock, TrendingUp, Flag, ArrowRight } from "lucide-react"
import Link from "next/link"
import { RisksWidget } from "./risks-widget"

interface Stream {
  id: string; name: string; status: string; progress: number; deadline: string | null
}
interface Risk { impact: "low" | "medium" | "high" | "critical"; status: string }
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

  // 5.3 — always load risks, show only high/critical
  const risksQuery = supabase
    .from("risks")
    .select("impact, status")
    .eq("status", "open")
    .in("impact", ["high", "critical"])

  const [{ data: streams }, { data: risks }, { data: activeSprints }, { data: activityLogs }] = await Promise.all([
    streamsQuery,
    risksQuery,
    supabase
      .from("sprints")
      .select(`id, name, status, start_date, end_date, task_sprint ( task_id, sprint_id, tasks ( status, streams ( project_id ) ) )`)
      .eq("status", "active"),
    supabase
      .from("activity_logs")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at"),
  ])

  const [{ data: milestoneRows }] = await Promise.all([
    projectId
      ? supabase.from("milestones").select("status").eq("project_id", projectId)
      : Promise.resolve({ data: [] as { status: string }[] }),
  ])

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

  const highCriticalRisks = (risks ?? []) as Risk[]

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

      {(streams ?? []).length === 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
          <h2 className="text-lg font-semibold mb-1">Laipni lūdzam Command Center!</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Vēl nav datu ko parādīt. Sāciet, izveidojot pirmo projektu un pievienojot tam straumes un uzdevumus.
          </p>
          <ol className="inline-flex flex-col gap-3 text-left text-sm max-w-xs mx-auto mb-6">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">1</span>
              <span><Link href="/projects" className="font-medium underline underline-offset-2 hover:text-primary">Izveidojiet projektu</Link> sadaļā Projekti</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">2</span>
              <span><Link href="/streams" className="font-medium underline underline-offset-2 hover:text-primary">Pievienojiet straumi</Link> (darba virzienus)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">3</span>
              <span><Link href="/tasks" className="font-medium underline underline-offset-2 hover:text-primary">Pievienojiet uzdevumus</Link> un sāciet darbu</span>
            </li>
          </ol>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sākt — izveidot projektu
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* 5.1 — 1. Sprinta veselība (augšā) */}
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

        {/* 5.1 + 5.3 + 5.4 — 2. Kritiskie riski */}
        <RisksWidget risks={highCriticalRisks} />

        {/* 5.1 — 3. Tuvākie milestones */}
        {milestoneTotal > 0 && (
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

        {/* 5.1 — 4. Aktivitātes feed (apakšā) */}
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

      </div>

      {/* 5.2 — Komandas noslodzes widgets pārvietots uz /team lapu */}

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
