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

interface Stream {
  id: string
  name: string
  goal: string | null
  owner_id: string | null
  status: string
  progress: number
  deadline: string | null
  created_at: string
  profiles: Profile | null
}

type FormData = {
  name: string
  goal: string
  owner_id: string
  status: string
  deadline: string
  progress: number
}

const EMPTY_FORM: FormData = {
  name: "",
  goal: "",
  owner_id: "",
  status: "active",
  deadline: "",
  progress: 0,
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

function statusBadge(status: string) {
  const map: Record<string, "default" | "warning" | "secondary" | "destructive"> = {
    active: "default",
    on_hold: "warning",
    completed: "secondary",
    cancelled: "destructive",
  }
  return (
    <Badge variant={map[status] ?? "secondary"}>
      {status.replace("_", " ")}
    </Badge>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  initialStreams: Stream[]
  profiles: Profile[]
}

export function StreamsClient({ initialStreams, profiles }: Props) {
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
            // Attach profile from local list
            newStream.profiles =
              profiles.find((p) => p.id === newStream.owner_id) ?? null
            setStreams((prev) => [newStream, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setStreams((prev) =>
              prev.map((s) => {
                if (s.id !== payload.new.id) return s
                const updated = { ...s, ...(payload.new as Stream) }
                updated.profiles =
                  profiles.find((p) => p.id === updated.owner_id) ?? null
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
      name: stream.name,
      goal: stream.goal ?? "",
      owner_id: stream.owner_id ?? "",
      status: stream.status,
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
    if (!form.name.trim()) { setError("Name is required"); return }
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      goal: form.goal.trim() || null,
      owner_id: form.owner_id || null,
      status: form.status,
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
          <h1 className="text-2xl font-bold">Streams</h1>
          <p className="text-sm text-muted-foreground">{streams.length} streams total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Stream
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {streams.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No streams yet — create one to get started.
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
                  </div>
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
                    ? new Date(stream.deadline).toLocaleDateString("en-US", { dateStyle: "medium" })
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
            <DialogTitle>{editingStream ? "Edit Stream" : "New Stream"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="s-name">Name *</Label>
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Platform Modernisation"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="s-goal">Goal</Label>
              <Textarea
                id="s-goal"
                value={form.goal}
                onChange={(e) => setField("goal", e.target.value)}
                placeholder="What does this stream aim to achieve?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Owner</Label>
                <Select value={form.owner_id} onValueChange={(v) => setField("owner_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Status</Label>
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
                <Label htmlFor="s-deadline">Deadline</Label>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingStream ? "Save changes" : "Create stream"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete stream?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{deleteTarget?.name}</strong> will be permanently deleted. Tasks in this
            stream will be unlinked but not deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
