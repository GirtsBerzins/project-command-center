"use client"

import { useState } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Plus, Pencil, Trash2, CalendarRange, CheckCircle2 } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────
export interface SimpleTask {
  id: string
  title: string
  status: string
  priority: string
  stream_id?: string | null
  streams?: { name: string } | null
}

interface SprintTask {
  task_id: string
  tasks: SimpleTask
}

export interface Sprint {
  id: string
  name: string
  start_date: string
  end_date: string
  goals: string | null
  status: string
  task_sprint: SprintTask[]
}

type SprintForm = {
  name: string; start_date: string; end_date: string; goals: string; status: string
}

const EMPTY_SPRINT: SprintForm = {
  name: "", start_date: "", end_date: "", goals: "", status: "planned",
}

const STATUS_COLORS: Record<string, string> = {
  planned:   "bg-slate-100 text-slate-700",
  active:    "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
}

const STATUS_LV: Record<string, string> = {
  planned:   "Plānots",
  active:    "Aktīvs",
  completed: "Pabeigts",
}

const TASK_STATUS_LV: Record<string, string> = {
  todo:        "Darāmais",
  in_progress: "Procesā",
  review:      "Pārskatāmais",
  done:        "Pabeigts",
}

// ─── Burnup chart data ────────────────────────────────────────────────────────
function buildBurnupData(sprint: Sprint) {
  const sprintTasks = sprint.task_sprint.map((ts) => ts.tasks)
  const total = sprintTasks.length
  if (total === 0) return []

  const start = new Date(sprint.start_date)
  const end   = new Date(sprint.end_date)
  const days  = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)

  const doneTasks  = sprintTasks.filter((t) => t.status === "done").length
  const donePerDay = doneTasks / days

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return {
      day:      date.toLocaleDateString("lv-LV", { month: "short", day: "numeric" }),
      Plānots:  total,
      Pabeigts: Math.min(doneTasks, Math.round(donePerDay * (i + 1))),
    }
  })
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  initialSprints: Sprint[]
  allTasks: SimpleTask[]
}

export function SprintsClient({ initialSprints, allTasks }: Props) {
  const supabase = createClient()
  const [sprints, setSprints]             = useState<Sprint[]>(initialSprints)
  const [sprintDialog, setSprintDialog]   = useState(false)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<Sprint | null>(null)
  const [taskDialog, setTaskDialog]       = useState<Sprint | null>(null)
  const [form, setForm]                   = useState<SprintForm>(EMPTY_SPRINT)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())

  function setField<K extends keyof SprintForm>(k: K, v: SprintForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // ── Open dialogs ──────────────────────────────────────────────────────────
  function openCreate() {
    setEditingSprint(null); setForm(EMPTY_SPRINT); setError(null); setSprintDialog(true)
  }

  function openEdit(sprint: Sprint) {
    setEditingSprint(sprint)
    setForm({
      name: sprint.name, start_date: sprint.start_date, end_date: sprint.end_date,
      goals: sprint.goals ?? "", status: sprint.status,
    })
    setError(null); setSprintDialog(true)
  }

  function openTaskAssign(sprint: Sprint) {
    setTaskDialog(sprint)
    setSelectedTaskIds(new Set(sprint.task_sprint.map((ts) => ts.task_id)))
  }

  // ── Save sprint ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim())   { setError("Nosaukums ir obligāts"); return }
    if (!form.start_date)    { setError("Sākuma datums ir obligāts"); return }
    if (!form.end_date)      { setError("Beigu datums ir obligāts"); return }
    setSaving(true); setError(null)

    const payload = {
      name: form.name.trim(), start_date: form.start_date, end_date: form.end_date,
      goals: form.goals.trim() || null, status: form.status,
    }

    if (editingSprint) {
      const { error: e } = await supabase.from("sprints").update(payload).eq("id", editingSprint.id)
      if (e) { setError(e.message); setSaving(false); return }
      setSprints((prev) =>
        prev.map((s) => s.id === editingSprint.id ? { ...s, ...payload } : s)
      )
    } else {
      const { data, error: e } = await supabase.from("sprints").insert(payload).select().single()
      if (e || !data) { setError(e?.message ?? "Kļūda"); setSaving(false); return }
      setSprints((prev) => [{ ...data, task_sprint: [] }, ...prev])
    }

    setSaving(false); setSprintDialog(false)
  }

  // ── Delete sprint ─────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from("sprints").delete().eq("id", deleteTarget.id)
    setSprints((prev) => prev.filter((s) => s.id !== deleteTarget.id))
    setDeleting(false); setDeleteTarget(null)
  }

  // ── Assign tasks ──────────────────────────────────────────────────────────
  async function handleAssignTasks() {
    if (!taskDialog) return
    setSaving(true)

    const currentIds = new Set(taskDialog.task_sprint.map((ts) => ts.task_id))
    const toAdd    = [...selectedTaskIds].filter((id) => !currentIds.has(id))
    const toRemove = [...currentIds].filter((id) => !selectedTaskIds.has(id))

    if (toAdd.length > 0) {
      await supabase.from("task_sprint").insert(
        toAdd.map((task_id) => ({ task_id, sprint_id: taskDialog.id }))
      )
    }
    if (toRemove.length > 0) {
      await supabase.from("task_sprint")
        .delete()
        .eq("sprint_id", taskDialog.id)
        .in("task_id", toRemove)
    }

    setSprints((prev) =>
      prev.map((s) => {
        if (s.id !== taskDialog.id) return s
        const newTaskSprint = [
          ...s.task_sprint.filter((ts) => selectedTaskIds.has(ts.task_id)),
          ...toAdd.map((id) => ({
            task_id: id,
            tasks: allTasks.find((t) => t.id === id)!,
          })),
        ]
        return { ...s, task_sprint: newTaskSprint }
      })
    )

    setSaving(false); setTaskDialog(null)
  }

  function toggleTask(id: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sprinti</h1>
          <p className="text-sm text-muted-foreground">{sprints.length} sprinti kopā</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Jauns sprints</Button>
      </div>

      {sprints.length === 0 && (
        <p className="text-muted-foreground py-12 text-center">Vēl nav sprintu.</p>
      )}

      <div className="space-y-4">
        {sprints.map((sprint) => {
          const tasks  = sprint.task_sprint.map((ts) => ts.tasks)
          const total  = tasks.length
          const done   = tasks.filter((t) => t.status === "done").length
          const pct    = total > 0 ? Math.round((done / total) * 100) : 0
          const burnup = buildBurnupData(sprint)

          return (
            <Card key={sprint.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{sprint.name}</CardTitle>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[sprint.status] ?? ""}`}>
                        {STATUS_LV[sprint.status] ?? sprint.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarRange className="h-3.5 w-3.5" />
                      {new Date(sprint.start_date).toLocaleDateString("lv-LV", { dateStyle: "medium" })}
                      {" — "}
                      {new Date(sprint.end_date).toLocaleDateString("lv-LV", { dateStyle: "medium" })}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openTaskAssign(sprint)}>
                      Piešķirt uzdevumus
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sprint)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(sprint)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Tabs defaultValue="overview">
                  <TabsList className="h-7 mb-3">
                    <TabsTrigger value="overview" className="text-xs h-6">Pārskats</TabsTrigger>
                    <TabsTrigger value="chart" className="text-xs h-6">Pieaugums</TabsTrigger>
                    <TabsTrigger value="tasks" className="text-xs h-6">Uzdevumi ({total})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-3 mt-0">
                    {sprint.goals && (
                      <p className="text-sm text-muted-foreground">{sprint.goals}</p>
                    )}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {done}/{total} uzdevumi pabeigti
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  </TabsContent>

                  <TabsContent value="chart" className="mt-0">
                    {burnup.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={burnup} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line type="monotone" dataKey="Plānots"  stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                          <Line type="monotone" dataKey="Pabeigts" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">Vēl nav piešķirtu uzdevumu.</p>
                    )}
                  </TabsContent>

                  <TabsContent value="tasks" className="mt-0">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Nav piešķirtu uzdevumu.</p>
                    ) : (
                      <div className="space-y-1">
                        {tasks.map((t) => (
                          <div key={t.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                            <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                            <Badge variant={t.status === "done" ? "secondary" : "outline"} className="text-xs h-5">
                              {TASK_STATUS_LV[t.status] ?? t.status.replace("_", " ")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Sprint create/edit dialog ────────────────────────────────────── */}
      <Dialog open={sprintDialog} onOpenChange={setSprintDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSprint ? "Rediģēt sprintu" : "Jauns sprints"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="sp-name">Nosaukums *</Label>
              <Input id="sp-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Sprints 16 — Laidiens" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sp-start">Sākums *</Label>
                <Input id="sp-start" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sp-end">Beigas *</Label>
                <Input id="sp-end" type="date" value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sp-goals">Mērķi</Label>
              <Textarea id="sp-goals" value={form.goals} onChange={(e) => setField("goals", e.target.value)} rows={2} placeholder="Ko vajadzētu sasniegt šajā sprintā?" />
            </div>
            <div className="space-y-1">
              <Label>Statuss</Label>
              <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["planned","active","completed"] as const).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LV[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSprintDialog(false)}>Atcelt</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saglabā…" : editingSprint ? "Saglabāt izmaiņas" : "Izveidot sprintu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign tasks dialog ──────────────────────────────────────────── */}
      <Dialog open={!!taskDialog} onOpenChange={(o) => { if (!o) setTaskDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Piešķirt uzdevumus — {taskDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[340px] overflow-y-auto space-y-1 py-1">
            {allTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nav pieejamu uzdevumu.</p>
            )}
            {allTasks.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTaskIds.has(t.id)}
                  onChange={() => toggleTask(t.id)}
                  className="h-4 w-4 rounded border-input"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{t.title}</p>
                  {t.streams && (
                    <p className="text-xs text-muted-foreground">{t.streams.name}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                  {TASK_STATUS_LV[t.status] ?? t.status.replace("_"," ")}
                </Badge>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialog(null)}>Atcelt</Button>
            <Button onClick={handleAssignTasks} disabled={saving}>
              {saving ? "Saglabā…" : `Saglabāt (${selectedTaskIds.size} uzdevumi)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Dzēst sprintu?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{deleteTarget?.name}</strong> tiks neatgriezeniski dzēsts. Uzdevumu piešķīrumi arī tiks noņemti.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Atcelt</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Dzēš…" : "Dzēst"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
