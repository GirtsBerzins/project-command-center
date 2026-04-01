"use client"

import { useMemo, useState, useEffect } from "react"
import type { Project } from "@/lib/supabase/types"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react"
import { PROJECT_STORAGE_KEY, updateSelectedProject } from "@/lib/project-selection"

interface Profile {
  id: string
  full_name: string | null
  email?: string | null
}

interface ProjectWithRelations extends Project {
  profiles: Profile | null
  milestones?: {
    id: string
    status: "planned" | "active" | "completed"
    weight_percent: number | null
    due_date: string | null
    completed_at: string | null
  }[]
}

type FormData = {
  name: string
  description: string
  owner_id: string
  start_date: string
  end_date: string
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  owner_id: "",
  start_date: "",
  end_date: "",
}

const STATUS_LABELS: Record<Project["status"], string> = {
  planned: "Plānots",
  active: "Aktīvs",
  delayed: "Iekavēts",
  completed: "Pabeigts",
}

function statusBadgeVariant(status: Project["status"]): "default" | "secondary" | "warning" | "destructive" {
  switch (status) {
    case "completed":
      return "secondary"
    case "active":
      return "default"
    case "delayed":
      return "destructive"
    default:
      return "warning"
  }
}

function calculateProgress(project: ProjectWithRelations): number {
  const milestones = project.milestones ?? []
  if (milestones.length === 0) return 0

  const totalWeight = milestones.reduce((sum, m) => sum + (m.weight_percent ?? 0), 0)
  if (totalWeight > 0) {
    const completedWeight = milestones
      .filter((m) => m.status === "completed")
      .reduce((sum, m) => sum + (m.weight_percent ?? 0), 0)
    return Math.round((completedWeight / totalWeight) * 100)
  }

  const completedCount = milestones.filter((m) => m.status === "completed").length
  return Math.round((completedCount / milestones.length) * 100)
}

function calculateStatusFromMilestones(project: ProjectWithRelations): Project["status"] {
  const milestones = project.milestones ?? []
  if (milestones.length === 0) return "planned"

  const completed = milestones.filter((m) => m.status === "completed")
  const now = new Date()
  const delayed = milestones.filter(
    (m) =>
      m.status !== "completed" &&
      m.due_date !== null &&
      new Date(m.due_date).getTime() < now.setHours(0, 0, 0, 0),
  )

  if (completed.length === milestones.length) return "completed"
  if (delayed.length > 0) return "delayed"
  if (completed.length > 0) return "active"
  return "planned"
}

interface Props {
  initialProjects: ProjectWithRelations[]
  profiles: Profile[]
}

export function ProjectsClient({ initialProjects, profiles }: Props) {
  const supabase = createClient()
  const [projects, setProjects] = useState<ProjectWithRelations[]>(initialProjects)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithRelations | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithRelations | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY)
      const stored = raw ? (JSON.parse(raw) as { id: string | null }) : null
      setActiveProjectId(stored?.id ?? null)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(t)
  }, [success])

  const enrichedProjects = useMemo(
    () =>
      projects.map((p) => {
        const derivedStatus = calculateStatusFromMilestones(p)
        const progress = calculateProgress(p)
        return { ...p, status: derivedStatus, _progress: progress } as ProjectWithRelations & {
          _progress: number
        }
      }),
    [projects],
  )

  function openCreate() {
    setEditingProject(null)
    setForm(EMPTY_FORM)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(project: ProjectWithRelations & { _progress?: number }) {
    setEditingProject(project)
    setForm({
      name: project.name,
      description: project.description ?? "",
      owner_id: project.owner_id ?? "",
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
    })
    setError(null)
    setDialogOpen(true)
  }

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Nosaukums ir obligāts")
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      owner_id: form.owner_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }

    if (editingProject) {
      const { error: e } = await supabase.from("projects").update(payload).eq("id", editingProject.id)
      if (e) {
        setError(e.message)
        setSaving(false)
        return
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? {
                ...p,
                ...payload,
              }
            : p,
        ),
      )
    } else {
      const { data, error: e } = await supabase
        .from("projects")
        .insert(payload)
        .select("*, profiles:owner_id(id, full_name), milestones(id, status, weight_percent, due_date, completed_at)")
        .single()
      if (e || !data) {
        setError(e?.message ?? "Kļūda")
        setSaving(false)
        return
      }
      setProjects((prev) => [data as ProjectWithRelations, ...prev])
    }

    setSaving(false)
    setDialogOpen(false)
    setSuccess(editingProject ? "Projekts veiksmīgi atjaunināts." : "Projekts veiksmīgi izveidots.")
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from("projects").delete().eq("id", deleteTarget.id)
    setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    setDeleting(false)
    setDeleteTarget(null)
    setSuccess(`Projekts "${deleteTarget.name}" dzēsts.`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projekti</h1>
          <p className="text-sm text-muted-foreground">{projects.length} projekti kopā</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Jauns projekts
        </Button>
      </div>

      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {success}
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nosaukums</TableHead>
              <TableHead>Īpašnieks</TableHead>
              <TableHead>Statuss</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Termiņš</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedProjects.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Vēl nav projektu — izveidojiet pirmo.
                </TableCell>
              </TableRow>
            )}
            {enrichedProjects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="font-medium text-left hover:underline focus-visible:outline-none focus-visible:underline"
                        title="Klikšķiniet, lai iestatītu šo projektu kā aktīvo — tas filtrēs uzdevumus, Gantta diagrammu un pārskatus"
                        onClick={() => {
                          updateSelectedProject({ id: project.id, name: project.name })
                          setActiveProjectId(project.id)
                        }}
                      >
                        {project.name}
                      </button>
                      {activeProjectId === project.id && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5"
                          title="Šis projekts ir pašlaik aktīvais"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Aktīvs
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                    )}
                    {activeProjectId !== project.id && (
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline mt-0.5"
                        onClick={() => {
                          updateSelectedProject({ id: project.id, name: project.name })
                          setActiveProjectId(project.id)
                        }}
                      >
                        Iestatīt kā aktīvo
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {project.profiles?.full_name ??
                    (project.profiles?.email ? (
                      <span className="text-muted-foreground">{project.profiles.email}</span>
                    ) : project.owner_id ? (
                      <span className="text-muted-foreground">{project.owner_id}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ))}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(project.status)}>
                    {STATUS_LABELS[project.status]}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <div className="space-y-1">
                    <Progress value={project._progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{project._progress}%</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {project.end_date ? (
                    new Date(project.end_date).toLocaleDateString("lv-LV", { dateStyle: "medium" })
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(project)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(project)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Rediģēt projektu" : "Jauns projekts"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="p-name">Nosaukums *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Sociālais tīkls"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="p-description">Apraksts</Label>
              <Textarea
                id="p-description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
                placeholder="Īss projekta apraksts"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Īpašnieks</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.owner_id || "none"}
                  onChange={(e) => setField("owner_id", e.target.value === "none" ? "" : e.target.value)}
                >
                  <option value="none">Nav norādīts</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name ?? p.email ?? p.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="p-end">Beigu datums</Label>
                <Input
                  id="p-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setField("end_date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="p-start">Sākuma datums</Label>
              <Input
                id="p-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Statuss (automātisks)</Label>
              <p className="text-sm text-muted-foreground">
                Statuss tiek aprēķināts automātiski no projekta atskaites punktiem (milestones) un nav
                tieši labojams.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saglabā…" : editingProject ? "Saglabāt izmaiņas" : "Izveidot projektu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst projektu?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{deleteTarget?.name}</strong> tiks neatgriezeniski dzēsts, ieskaitot saistītos atskaites punktus
            (milestones).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Atcelt
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Dzēš…" : "Dzēst"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

