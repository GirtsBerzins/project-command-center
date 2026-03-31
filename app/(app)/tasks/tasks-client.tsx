"use client"

import { useEffect, useState } from "react"
import {
  DragDropContext, Droppable, Draggable, type DropResult,
} from "@hello-pangea/dnd"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, User, Calendar, GripVertical } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────
interface Profile { id: string; full_name: string | null }
interface Stream  { id: string; name: string }

interface Task {
  id: string
  title: string
  description: string | null
  stream_id: string | null
  assignee_id: string | null
  priority: string
  status: string
  due_date: string | null
  estimate_hours: number | null
  actual_hours: number | null
  created_at: string
  profiles: Profile | null
  streams: Stream | null
}

type FormData = {
  title: string
  description: string
  stream_id: string
  assignee_id: string
  priority: string
  status: string
  due_date: string
  estimate_hours: string
}

const EMPTY_FORM: FormData = {
  title: "", description: "", stream_id: "", assignee_id: "",
  priority: "medium", status: "todo", due_date: "", estimate_hours: "",
}

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: "todo",        label: "Darāmais",     color: "border-t-slate-400" },
  { id: "in_progress", label: "Procesā",      color: "border-t-blue-400" },
  { id: "review",      label: "Pārskatāmais", color: "border-t-yellow-400" },
  { id: "done",        label: "Pabeigts",     color: "border-t-green-400" },
]

const PRIORITY_COLORS: Record<string, string> = {
  low:      "bg-slate-100 text-slate-700",
  medium:   "bg-blue-100 text-blue-700",
  high:     "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
}

const PRIORITY_LV: Record<string, string> = {
  low:      "Zema",
  medium:   "Vidēja",
  high:     "Augsta",
  critical: "Kritiska",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLORS[priority] ?? ""}`}>
      {PRIORITY_LV[priority] ?? priority}
    </span>
  )
}

function Avatar({ name }: { name: string | null | undefined }) {
  if (!name) return <User className="h-4 w-4 text-muted-foreground" />
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
      {initials}
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  initialTasks: Task[]
  streams: Stream[]
  profiles: Profile[]
}

export function TasksClient({ initialTasks, streams, profiles }: Props) {
  const supabase = createClient()
  const [tasks, setTasks]               = useState<Task[]>(initialTasks)
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [editingTask, setEditingTask]   = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [form, setForm]                 = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // Filters — "all" means no filter applied
  const [filterStream,   setFilterStream]   = useState("all")
  const [filterAssignee, setFilterAssignee] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const t = payload.new as Task
          t.profiles = profiles.find((p) => p.id === t.assignee_id) ?? null
          t.streams  = streams.find((s) => s.id === t.stream_id) ?? null
          setTasks((prev) => [t, ...prev])
        } else if (payload.eventType === "UPDATE") {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== payload.new.id) return t
              const updated = { ...t, ...(payload.new as Task) }
              updated.profiles = profiles.find((p) => p.id === updated.assignee_id) ?? null
              updated.streams  = streams.find((s) => s.id === updated.stream_id) ?? null
              return updated
            })
          )
        } else if (payload.eventType === "DELETE") {
          setTasks((prev) => prev.filter((t) => t.id !== (payload.old as { id: string }).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, profiles, streams])

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  async function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const taskId    = result.draggableId
    const newStatus = result.destination.droppableId

    setTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t)
    )
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId)
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = tasks.filter((t) => {
    if (filterStream   !== "all" && t.stream_id   !== filterStream)   return false
    if (filterAssignee !== "all" && t.assignee_id !== filterAssignee) return false
    if (filterPriority !== "all" && t.priority    !== filterPriority) return false
    return true
  })

  function tasksForColumn(colId: string) {
    return filtered.filter((t) => t.status === colId)
  }

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openCreate(status = "todo") {
    setEditingTask(null)
    setForm({ ...EMPTY_FORM, status })
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setForm({
      title:          task.title,
      description:    task.description ?? "",
      stream_id:      task.stream_id ?? "",
      assignee_id:    task.assignee_id ?? "",
      priority:       task.priority,
      status:         task.status,
      due_date:       task.due_date ?? "",
      estimate_hours: task.estimate_hours?.toString() ?? "",
    })
    setError(null)
    setDialogOpen(true)
  }

  function setField<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim()) { setError("Virsraksts ir obligāts"); return }
    setSaving(true); setError(null)

    const payload = {
      title:          form.title.trim(),
      description:    form.description.trim() || null,
      stream_id:      form.stream_id  || null,
      assignee_id:    form.assignee_id || null,
      priority:       form.priority,
      status:         form.status,
      due_date:       form.due_date   || null,
      estimate_hours: form.estimate_hours ? Number(form.estimate_hours) : null,
    }

    const { error: sbError } = editingTask
      ? await supabase.from("tasks").update(payload).eq("id", editingTask.id)
      : await supabase.from("tasks").insert(payload)

    setSaving(false)
    if (sbError) { setError(sbError.message); return }
    setDialogOpen(false)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from("tasks").delete().eq("id", deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const filtersActive = filterStream !== "all" || filterAssignee !== "all" || filterPriority !== "all"

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Uzdevumi</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} uzdevumi kopā</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          Jauns uzdevums
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterStream} onValueChange={setFilterStream}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Visas straumes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visas straumes</SelectItem>
            {streams.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Visi izpildītāji" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi izpildītāji</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Visas prioritātes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visas prioritātes</SelectItem>
            {(["low","medium","high","critical"] as const).map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LV[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setFilterStream("all"); setFilterAssignee("all"); setFilterPriority("all") }}
          >
            Notīrīt filtrus
          </Button>
        )}
      </div>

      {/* Kanban board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-4 gap-3 min-h-[500px]">
          {COLUMNS.map((col) => {
            const colTasks = tasksForColumn(col.id)
            return (
              <div key={col.id} className={`flex flex-col rounded-lg border border-t-4 bg-muted/30 ${col.color}`}>
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-background/60 rounded-t-md">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">{colTasks.length}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openCreate(col.id)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2 space-y-2 min-h-[100px] transition-colors ${
                        snapshot.isDraggingOver ? "bg-accent/50" : ""
                      }`}
                    >
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(drag, dragSnapshot) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className={`bg-background rounded-md border p-3 space-y-2 group shadow-sm ${
                                dragSnapshot.isDragging ? "shadow-lg rotate-1 opacity-90" : ""
                              }`}
                            >
                              {/* Drag handle + actions */}
                              <div className="flex items-start justify-between gap-1">
                                <div
                                  {...drag.dragHandleProps}
                                  className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab mt-0.5 shrink-0"
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </div>
                                <p className="text-sm font-medium flex-1 leading-snug">{task.title}</p>
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                  <button
                                    onClick={() => openEdit(task)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget(task)}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Stream label */}
                              {task.streams && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1">
                                  {task.streams.name}
                                </p>
                              )}

                              {/* Footer: priority + assignee + due date */}
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <PriorityBadge priority={task.priority} />
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  {task.due_date && (
                                    <span className="flex items-center gap-0.5 text-[11px]">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(task.due_date).toLocaleDateString("lv-LV", { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                  <Avatar name={task.profiles?.full_name} />
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* ── Create / Edit dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Rediģēt uzdevumu" : "Jauns uzdevums"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="t-title">Virsraksts *</Label>
              <Input id="t-title" value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Uzdevuma nosaukums" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="t-desc">Apraksts</Label>
              <Textarea id="t-desc" value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} placeholder="Papildu informācija…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Straume</Label>
                <Select
                  value={form.stream_id || "none"}
                  onValueChange={(v) => setField("stream_id", v === "none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Nav" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nav</SelectItem>
                    {streams.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Izpildītājs</Label>
                <Select
                  value={form.assignee_id || "none"}
                  onValueChange={(v) => setField("assignee_id", v === "none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Nav norādīts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nav norādīts</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0,8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioritāte</Label>
                <Select value={form.priority} onValueChange={(v) => setField("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["low","medium","high","critical"] as const).map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_LV[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Statuss</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="t-due">Termiņš</Label>
                <Input id="t-due" type="date" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="t-est">Plānotās stundas</Label>
                <Input id="t-est" type="number" min={0} step={0.5} value={form.estimate_hours} onChange={(e) => setField("estimate_hours", e.target.value)} placeholder="0" />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Atcelt</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saglabā…" : editingTask ? "Saglabāt izmaiņas" : "Izveidot uzdevumu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst uzdevumu?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{deleteTarget?.title}</strong> tiks neatgriezeniski dzēsts.
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
