"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2 } from "lucide-react"

type Milestone = {
  id: string
  project_id: string | null
  stream_id: string | null
  title: string
  description: string | null
  weight_percent: number | null
  status: string
  due_date: string | null
  completed_at: string | null
  created_at: string
}

const STATUS_LV: Record<string, string> = {
  planned: "Plānots",
  reached: "Sasniegts",
  missed: "Nokavēts",
}

const STATUS_BADGE: Record<string, "secondary" | "success" | "destructive"> = {
  planned: "secondary",
  reached: "success",
  missed: "destructive",
}

export function MilestonesClient(props: {
  initialMilestones: Milestone[]
  projectId: string | null
  projects: { id: string; name: string }[]
  tasks: { id: string; title: string; status: string }[]
  links: { milestone_id: string; task_id: string }[]
  myRole?: "owner" | "manager" | "member" | "viewer"
}) {
  const { initialMilestones, projectId, projects, tasks, links: initialLinks, myRole } = props
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState(initialMilestones)
  const [links, setLinks] = useState(initialLinks)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Milestone | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [status, setStatus] = useState("planned")
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const canEdit = myRole === "owner" || myRole === "manager"

  useEffect(() => {
    setRows(initialMilestones)
  }, [initialMilestones])

  useEffect(() => {
    setLinks(initialLinks)
  }, [initialLinks])

  const linkByMilestone = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const l of links) {
      const arr = m.get(l.milestone_id) ?? []
      arr.push(l.task_id)
      m.set(l.milestone_id, arr)
    }
    return m
  }, [links])

  function openCreate() {
    setEditing(null)
    setTitle("")
    setDescription("")
    setDueDate("")
    setStatus("planned")
    setSelectedTasks([])
    setDialogOpen(true)
  }

  function openEdit(m: Milestone) {
    setEditing(m)
    setTitle(m.title)
    setDescription(m.description ?? "")
    setDueDate(m.due_date ?? "")
    setStatus(m.status)
    setSelectedTasks(linkByMilestone.get(m.id) ?? [])
    setDialogOpen(true)
  }

  async function persistLinks(milestoneId: string, taskIds: string[]) {
    await supabase.from("milestone_tasks").delete().eq("milestone_id", milestoneId)
    if (taskIds.length === 0) return
    await supabase
      .from("milestone_tasks")
      .insert(taskIds.map((task_id) => ({ milestone_id: milestoneId, task_id })))
  }

  async function handleSave() {
    if (!title.trim() || !projectId) return
    setSaving(true)
    try {
      const payload = {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        status,
      }
      if (editing) {
        await supabase.from("milestones").update(payload).eq("id", editing.id)
        await persistLinks(editing.id, selectedTasks)
      } else {
        const { data: ins, error } = await supabase.from("milestones").insert(payload).select("id").single()
        if (error) throw error
        if (ins?.id) await persistLinks(ins.id, selectedTasks)
      }
      setDialogOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from("milestone_tasks").delete().eq("milestone_id", deleteTarget.id)
    await supabase.from("milestones").delete().eq("id", deleteTarget.id)
    setDeleteTarget(null)
    router.refresh()
  }

  function toggleTask(id: string) {
    setSelectedTasks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const projectName = projects.find((p) => p.id === projectId)?.name

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Atskaites punkti</h1>
          <p className="text-sm text-muted-foreground">
            {projectName ? projectName : "Visi projekti"} — {rows.length} ieraksti
          </p>
          {!projectId && (
            <p className="text-xs text-amber-700 mt-1">Atlasiet projektu sānjoslē, lai pārvaldītu atskaites punktus.</p>
          )}
        </div>
        {canEdit && projectId && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Jauns atskaites punkts
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nosaukums</TableHead>
              <TableHead>Termiņš</TableHead>
              <TableHead>Statuss</TableHead>
              <TableHead>Saistītie uzdevumi</TableHead>
              {canEdit && <TableHead className="w-[100px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-sm">
                  Nav atskaišu punktu.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => {
                const tids = linkByMilestone.get(m.id) ?? []
                const done = tids.filter((tid) => tasks.find((t) => t.id === tid)?.status === "done").length
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="text-sm">
                      {m.due_date ? new Date(m.due_date).toLocaleDateString("lv-LV") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[m.status] ?? "secondary"}>{STATUS_LV[m.status] ?? m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tids.length ? `${done}/${tids.length} pabeigti` : "—"}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Rediģēt" : "Jauns atskaites punkts"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label>Nosaukums *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Apraksts</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Termiņš</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Statuss</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Plānots</SelectItem>
                  <SelectItem value="reached">Sasniegts</SelectItem>
                  <SelectItem value="missed">Nokavēts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tasks.length > 0 && (
              <div className="space-y-2">
                <Label>Saistītie uzdevumi (sasniegts, kad visi pabeigti)</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1 text-sm">
                  {tasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTasks.includes(t.id)}
                        onChange={() => toggleTask(t.id)}
                        className="rounded border"
                      />
                      <span className="truncate">{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              Saglabāt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dzēst atskaites punktu?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Atcelt
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Dzēst
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
