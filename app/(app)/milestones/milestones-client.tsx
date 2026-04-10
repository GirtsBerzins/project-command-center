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
  DialogDescription,
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

/** Latvian count phrase for "task(s)" */
function linkedTasksCountLabel(n: number): string {
  if (n === 0) return "0 uzdevumu"
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} uzdevums`
  if (m10 > 1 && m10 < 10 && (m100 < 10 || m100 > 20)) return `${n} uzdevumi`
  return `${n} uzdevumu`
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
  const supabase = useMemo(() => createClient(), [])
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
  const [taskSearch, setTaskSearch] = useState("")
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
    setTaskSearch("")
    setDialogOpen(true)
  }

  function openEdit(m: Milestone) {
    setEditing(m)
    setTitle(m.title)
    setDescription(m.description ?? "")
    setDueDate(m.due_date ?? "")
    setStatus(m.status)
    setSelectedTasks(linkByMilestone.get(m.id) ?? [])
    setTaskSearch("")
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
      let milestoneId: string | null = null
      let priorCompletedAt: string | null = null

      if (editing) {
        await supabase.from("milestones").update(payload).eq("id", editing.id)
        await persistLinks(editing.id, selectedTasks)
        milestoneId = editing.id
        priorCompletedAt = editing.completed_at
      } else {
        const { data: ins, error } = await supabase
          .from("milestones")
          .insert(payload)
          .select("id, completed_at")
          .single()
        if (error) throw error
        if (ins?.id) {
          await persistLinks(ins.id, selectedTasks)
          milestoneId = ins.id
          priorCompletedAt = ins.completed_at
        }
      }

      if (milestoneId && selectedTasks.length > 0) {
        const allDone = selectedTasks.every((tid) => tasks.find((t) => t.id === tid)?.status === "done")
        if (allDone) {
          await supabase
            .from("milestones")
            .update({
              status: "reached",
              completed_at: priorCompletedAt ?? new Date().toISOString(),
            })
            .eq("id", milestoneId)
        }
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

  const filteredTasksForPicker = useMemo(() => {
    const q = taskSearch.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t) => t.title.toLowerCase().includes(q))
  }, [tasks, taskSearch])

  const emptyColSpan = canEdit ? 5 : 4

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
                <TableCell colSpan={emptyColSpan} className="text-muted-foreground text-sm py-10 text-center">
                  Nav atskaites punktu. Izveidojiet pirmo!
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => {
                const tids = linkByMilestone.get(m.id) ?? []
                const done = tids.filter((tid) => tasks.find((t) => t.id === tid)?.status === "done").length
                const allLinkedDone = tids.length > 0 && done === tids.length
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
                      {tids.length > 0 ? (
                        <span>
                          <span className="text-foreground">{linkedTasksCountLabel(tids.length)}</span>
                          {allLinkedDone ? (
                            <span className="text-muted-foreground"> · visi pabeigti</span>
                          ) : (
                            <span className="text-muted-foreground">
                              {" "}
                              · {done}/{tids.length} pabeigti
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Rediģēt atskaites punktu" : "Jauns atskaites punkts"}</DialogTitle>
            <DialogDescription>
              Atskaites punkts ir svarīgs projekta posms vai mērķis ar konkrētu termiņu.
            </DialogDescription>
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
            <div className="space-y-2">
              <div>
                <Label>Saistītie uzdevumi</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Kad visi atlasītie uzdevumi ir ar statusu «Pabeigts», atskaites punkts automātiski iegūst statusu
                  «Sasniegts».
                </p>
              </div>
              {!projectId ? (
                <p className="text-sm text-muted-foreground border rounded-md p-3">
                  Atlasiet projektu sānjoslē, lai saistītu uzdevumus.
                </p>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-md p-3">
                  Šim projektam nav uzdevumu straumēs — neko nevar saistīt.
                </p>
              ) : (
                <>
                  <Input
                    placeholder="Meklēt uzdevumu…"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="h-9"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      Atlasīti: {selectedTasks.length} / {tasks.length}
                    </span>
                    {selectedTasks.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedTasks([])}>
                        Notīrīt
                      </Button>
                    )}
                  </div>
                  <div
                    className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 text-sm"
                    role="group"
                    aria-label="Saistītie uzdevumi — vairāku izvēle"
                  >
                    {filteredTasksForPicker.length === 0 ? (
                      <p className="text-muted-foreground text-xs py-2 px-1">Nav rezultātu meklējumam.</p>
                    ) : (
                      filteredTasksForPicker.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-start gap-2 cursor-pointer rounded-sm px-1 py-1 hover:bg-muted/60"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTasks.includes(t.id)}
                            onChange={() => toggleTask(t.id)}
                            className="mt-1 rounded border"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{t.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {t.status === "done" ? "Pabeigts" : "Nav pabeigts"}
                            </span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
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
