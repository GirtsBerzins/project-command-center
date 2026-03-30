import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ActivitySparkline } from "./activity-sparkline"
import { AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────
interface Stream {
  id: string
  name: string
  status: string
  progress: number
  deadline: string | null
}

interface Risk {
  impact: "low" | "medium" | "high"
  status: string
}

interface Task {
  status: string
}

interface TaskSprint {
  task_id: string
  sprint_id: string
  tasks: Task
}

interface Sprint {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  task_sprint: TaskSprint[]
}

interface ActivityLog {
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
    day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
    count,
  }))
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: streams },
    { data: risks },
    { data: activeSprint },
    { data: activityLogs },
  ] = await Promise.all([
    supabase
      .from("streams")
      .select("id, name, status, progress, deadline")
      .order("progress", { ascending: false }),

    supabase
      .from("risks")
      .select("impact, status")
      .eq("status", "open"),

    supabase
      .from("sprints")
      .select(`
        id, name, status, start_date, end_date,
        task_sprint (
          task_id, sprint_id,
          tasks ( status )
        )
      `)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),

    supabase
      .from("activity_logs")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at"),
  ])

  // Risk counts
  const riskCounts = { high: 0, medium: 0, low: 0 }
  for (const r of risks ?? []) {
    riskCounts[r.impact as keyof typeof riskCounts]++
  }

  // Sprint health
  const sprintTasks = (activeSprint?.task_sprint ?? []) as unknown as TaskSprint[]
  const totalTasks = sprintTasks.length
  const doneTasks = sprintTasks.filter((ts) => ts.tasks?.status === "done").length
  const sprintPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  // Activity sparkline
  const sparklineData = buildSparklineData((activityLogs ?? []) as ActivityLog[])
  const totalActivity = sparklineData.reduce((s, d) => s + d.count, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Project overview — {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
        </p>
      </div>

      {/* Top widgets row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Risk Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Open Risks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">High</span>
              <Badge variant="destructive">{riskCounts.high}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Medium</span>
              <Badge variant="warning">{riskCounts.medium}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Low</span>
              <Badge variant="secondary">{riskCounts.low}</Badge>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              {(risks ?? []).length} total open risks
            </p>
          </CardContent>
        </Card>

        {/* Sprint Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              Sprint Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSprint ? (
              <>
                <p className="text-sm font-medium">{activeSprint.name}</p>
                <Progress value={sprintPct} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{doneTasks}/{totalTasks} tasks done</span>
                  <span>{sprintPct}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ends {new Date(activeSprint.end_date).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active sprint</p>
            )}
          </CardContent>
        </Card>

        {/* 7-day Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              7-Day Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalActivity}</p>
            <p className="text-xs text-muted-foreground mb-2">events this week</p>
            <ActivitySparkline data={sparklineData} />
          </CardContent>
        </Card>
      </div>

      {/* Stream Progress Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Stream Progress
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(streams ?? []).map((stream: Stream) => (
            <Card key={stream.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{stream.name}</CardTitle>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(stream.status)}`}
                  >
                    {stream.status.replace("_", " ")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={stream.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stream.progress}% complete</span>
                  {stream.deadline && (
                    <span>
                      Due {new Date(stream.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
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
