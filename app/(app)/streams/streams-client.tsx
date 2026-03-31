"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Pencil, Plus, Trash2 } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string | null
}

interface Project {
  id: string
  name: string
}

interface SprintSummary {
  sprints?: {
    id: string
    name: string
    status: string
  } | null
}

interface Stream {
  id: string
  name: string
  goal: string | null
  owner_id: string | null
  project_id: string | null
  status: string
  progress: number
  deadline: string | null
  created_at: string
  profiles: Profile | null
  projects?: Project | null
  sprint_streams?: SprintSummary[]
}

type FormData = {
  name: string
  goal: string
  owner_id: string
  project_id: string
  status: string
  deadline: string
  progress: number
}

const EMPTY_FORM: FormData = {
  name: "",
  goal: "",
  owner_id: "",
  project_id: "",
  status: "active",
  deadline: "",
  progress: 0,
}

const STATUS_OPTIONS = [
  { value: "active",    label: "Aktīvs" },
  { value: "on_hold",   label: "Aizturēts" },
  { value: "completed", label: "Pabeigts" },
  { value: "cancelled", label: "Atcelts" },
]

const STATUS_LV: Record<string, string> = {
  active:    "Aktīvs",
  on_hold:   "Aizturēts",
  completed: "Pabeigts",
  cancelled: "Atcelts",
}

function statusBadge(status: string) {
  const map: Record<string, "default" | "warning" | "secondary" | "destructive"> = {
    active:    "default",
    on_hold:   "warning",
    completed: "secondary",
    cancelled: "destructive",
  }
  return (
    <Badge variant={map[status] ?? "secondary"}>
      {STATUS_LV[status] ?? status}
    </Badge>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  initialStreams: Stream[]
  profiles: Profile[]
  projects: Project[]
}

export function StreamsClient({ initialStreams, profiles, projects }: Props) {
  const supabase = createClient()
  const [streams, setStreams] = useState<Stream[]>(initialStreams)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStream, setEditingStream] = useState<Stream | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Stream | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("streams-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "streams" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newStream = payload.new as Stream
            newStream.profiles =
              profiles.find((p) => p.id === newStream.owner_id) ?? null
            newStream.projects =
              projects.find((p) => p.id === newStream.project_id) ?? null
            setStreams((prev) => [newStream, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setStreams((prev) =>
              prev.map((s) => {
                if (s.id !== payload.new.id) return s
                const updated = { ...s, ...(payload.new as Stream) }
                updated.profiles =
                  profiles.find((p) => p.id === updated.owner_id) ?? null
                updated.projects =
                  projects.find((p) => p.id === updated.project_id) ?? null
                return updated
              })
            )
          } else if (payload.eventType === "DELETE") {
            setStreams((prev) =>
              prev.filter((s) => s.id !== (payload.old as { id: string }).id)
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, profiles])

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openCreate() {
    setEditingStream(null)
    setForm(EMPTY_FORM)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(stream: Stream) {
    setEditingStream(stream)
    setForm({
      name:     stream.name,
      goal:     stream.goal ?? "",
      owner_id: stream.owner_id ?? "",
      project_id: stream.project_id ?? "",
      status:   stream.status,
      deadline: stream.deadline ?? "",
      progress: stream.progress,
    })
    setError(null)
    setDialogOpen(true)
  }

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { setError("Nosaukums ir obligāts"); return }
    setSaving(true)
    setError(null)

    const payload = {
      name:     form.name.trim(),
      goal:     form.goal.trim() || null,
      owner_id: form.owner_id || null,
      project_id: form.project_id || null,
      status:   form.status,
      deadline: form.deadline || null,
      progress: Number(form.progress),
    }

    const { error: sbError } = editingStream
      ? await supabase.from("streams").update(payload).eq("id", editingStream.id)
      : await supabase.from("streams").insert(payload)

    setSaving(false)
    if (sbError) { setError(sbError.message); return }
    setDialogOpen(false)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from("streams").delete().eq("id", deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Straumes</h1>
          <p className="text-sm text-muted-foreground">{streams.length} straumes kopā</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Jauna straume
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nosaukums</TableHead>
              <TableHead>Projekts</TableHead>
              <TableHead>Īpašnieks</TableHead>
              <TableHead>Statuss</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Termiņš</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {streams.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Vēl nav straumju — izveidojiet pirmo.
                </TableCell>
              </TableRow>
            )}
            {streams.map((stream) => (
                <TableRow key={stream.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{stream.name}</p>
                      {stream.goal && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{stream.goal}</p>
                      )}
                      {stream.sprint_streams && stream.sprint_streams.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Aktīvie sprinti:{" "}
                          {stream.sprint_streams
                            .map((ss) => ss.sprints)
                            .filter((s) => s && s.status === "active")
                            .map((s) => s!.name)
                            .join(", ") || "—"}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {stream.projects?.name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {stream.profiles?.full_name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                <TableCell>{statusBadge(stream.status)}</TableCell>
                <TableCell className="min-w-[140px]">
                  <div className="space-y-1">
                    <Progress value={stream.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{stream.progress}%</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {stream.deadline
                    ? new Date(stream.deadline).toLocaleDateString("lv-LV", { dateStyle: "medium" })
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(stream)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(stream)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Create / Edit dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStream ? "Rediģēt straumi" : "Jauna straume"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="s-name">Nosaukums *</Label>
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Platformas modernizācija"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="s-goal">Mērķis</Label>
              <Textarea
                id="s-goal"
                value={form.goal}
                onChange={(e) => setField("goal", e.target.value)}
                placeholder="Ko šī straume plāno sasniegt?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Īpašnieks</Label>
                <Select value={form.owner_id || "none"} onValueChange={(v) => setField("owner_id", v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nav norādīts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nav norādīts</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Projekts</Label>
                <Select
                  value={form.project_id || "none"}
                  onValueChange={(v) => setField("project_id", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Visi projekti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nav norādīts</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Statuss</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="s-deadline">Termiņš</Label>
                <Input
                  id="s-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setField("deadline", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="s-progress">Progress ({form.progress}%)</Label>
                <Input
                  id="s-progress"
                  type="range"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(e) => setField("progress", Number(e.target.value))}
                  className="cursor-pointer h-10 px-0"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Atcelt</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saglabā…" : editingStream ? "Saglabāt izmaiņas" : "Izveidot straumi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst straumi?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{deleteTarget?.name}</strong> tiks neatgriezeniski dzēsta. Uzdevumi šajā straumē tiks atvienoti, bet netiks dzēsti.
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
