"use client"

import { useMemo, useState } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────
interface Profile { id: string; full_name: string | null; email?: string | null }

interface KpiValue {
  id: string
  kpi_id: string
  value: number
  recorded_at: string
}

interface Kpi {
  id: string
  name: string
  target: number
  current: number
  unit: string | null
  trend: string
  owner_id: string | null
  period: string | null
  project_id?: string | null
  profiles: Profile | null
  kpi_values: KpiValue[]
}

type KpiForm = {
  name: string; target: string; current: string; unit: string
  trend: string; owner_id: string; period: string
}

const EMPTY_KPI: KpiForm = {
  name: "", target: "", current: "0", unit: "",
  trend: "stable", owner_id: "", period: "",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")   return <TrendingUp   className="h-4 w-4 text-green-500" />
  if (trend === "down") return <TrendingDown  className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function pct(current: number, target: number) {
  if (target === 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function chartData(values: KpiValue[]) {
  return values.map((v) => ({
    date:  new Date(v.recorded_at).toLocaleDateString("lv-LV", { month: "short", day: "numeric" }),
    Vērtība: Number(v.value),
  }))
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  initialKpis: Kpi[]
  profiles: Profile[]
  selectedProjectId?: string | null
  selectedProjectName?: string | null
}

export function KpisClient({ initialKpis, profiles, selectedProjectId, selectedProjectName }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [kpis, setKpis]               = useState<Kpi[]>(initialKpis)
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [editingKpi, setEditingKpi]   = useState<Kpi | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Kpi | null>(null)
  const [form, setForm]               = useState<KpiForm>(EMPTY_KPI)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [recordingKpi, setRecordingKpi] = useState<Kpi | null>(null)
  const [newValue, setNewValue]         = useState("")
  const [recording, setRecording]       = useState(false)

  function setField<K extends keyof KpiForm>(k: K, v: KpiForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // ── Open dialogs ──────────────────────────────────────────────────────────
  function openCreate() {
    setEditingKpi(null); setForm(EMPTY_KPI); setError(null); setDialogOpen(true)
  }

  function openEdit(kpi: Kpi) {
    setEditingKpi(kpi)
    setForm({
      name: kpi.name, target: String(kpi.target), current: String(kpi.current),
      unit: kpi.unit ?? "", trend: kpi.trend,
      owner_id: kpi.owner_id ?? "", period: kpi.period ?? "",
    })
    setError(null); setDialogOpen(true)
  }

  // ── Save KPI ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { setError("Nosaukums ir obligāts"); return }
    if (!form.target)      { setError("Mērķis ir obligāts"); return }
    setSaving(true); setError(null)

    const payload = {
      name:     form.name.trim(),
      target:   Number(form.target),
      current:  Number(form.current),
      unit:     form.unit.trim()   || null,
      trend:    form.trend,
      owner_id: form.owner_id      || null,
      period:   form.period.trim() || null,
      project_id: selectedProjectId ?? null,
    }

    if (editingKpi) {
      const { error: e } = await supabase.from("kpis").update(payload).eq("id", editingKpi.id)
      if (e) { setError(e.message); setSaving(false); return }
      setKpis((prev) =>
        prev.map((k) => k.id === editingKpi.id ? { ...k, ...payload } : k)
      )
    } else {
      const { data, error: e } = await supabase.from("kpis").insert(payload).select().single()
      if (e || !data) { setError(e?.message ?? "Kļūda"); setSaving(false); return }
      setKpis((prev) => [{
        ...data,
        profiles:   profiles.find((p) => p.id === data.owner_id) ?? null,
        kpi_values: [],
      }, ...prev])
    }

    setSaving(false); setDialogOpen(false)
  }

  // ── Delete KPI ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from("kpis").delete().eq("id", deleteTarget.id)
    setKpis((prev) => prev.filter((k) => k.id !== deleteTarget.id))
    setDeleting(false); setDeleteTarget(null)
  }

  // ── Record new value ──────────────────────────────────────────────────────
  async function handleRecordValue() {
    if (!recordingKpi || !newValue) return
    setRecording(true)

    const val = Number(newValue)
    const { data, error: e } = await supabase
      .from("kpi_values")
      .insert({ kpi_id: recordingKpi.id, value: val })
      .select()
      .single()

    if (!e && data) {
      await supabase.from("kpis").update({ current: val }).eq("id", recordingKpi.id)

      setKpis((prev) =>
        prev.map((k) => {
          if (k.id !== recordingKpi.id) return k
          return {
            ...k,
            current:    val,
            kpi_values: [...k.kpi_values, data as KpiValue],
          }
        })
      )
    }

    setRecording(false); setRecordingKpi(null); setNewValue("")
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KPI rādītāji</h1>
          <p className="text-sm text-muted-foreground">
            {kpis.length} rādītāji tiek sekoti
            {selectedProjectId ? ` · projekts: ${selectedProjectName ?? "atlasītais"}` : ""}
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Jauns KPI</Button>
      </div>

      {kpis.length === 0 && (
        <p className="text-muted-foreground py-12 text-center">Vēl nav KPI — pievienojiet pirmo.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {kpis.map((kpi) => {
          const progress = pct(kpi.current, kpi.target)
          const onTrack  = kpi.current >= kpi.target * 0.85
          const data     = chartData(kpi.kpi_values)

          return (
            <Card key={kpi.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <TrendIcon trend={kpi.trend} />
                      {kpi.name}
                    </CardTitle>
                    {kpi.period && (
                      <p className="text-xs text-muted-foreground">{kpi.period}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => { setRecordingKpi(kpi); setNewValue(String(kpi.current)) }}
                    >
                      Reģistrēt
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(kpi)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(kpi)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Current / Target */}
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {kpi.current}{kpi.unit && <span className="text-base font-normal text-muted-foreground ml-0.5">{kpi.unit}</span>}
                  </span>
                  <span className="text-sm text-muted-foreground mb-1">
                    / {kpi.target}{kpi.unit ?? ""}
                  </span>
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${onTrack ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {progress}% no mērķa
                  </span>
                </div>

                {/* Owner */}
                {kpi.profiles && (
                  <p className="text-xs text-muted-foreground">Īpašnieks: {kpi.profiles.full_name}</p>
                )}

                {/* History chart */}
                {data.length > 1 ? (
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={kpi.target} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "Mērķis", fontSize: 9, fill: "#22c55e" }} />
                      <Line type="monotone" dataKey="Vērtība" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {data.length === 0
                      ? "Vēl nav vēstures — reģistrējiet vērtību."
                      : "Reģistrējiet vairāk vērtību, lai redzētu grafiku."}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Create / Edit dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKpi ? "Rediģēt KPI" : "Jauns KPI"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="k-name">Nosaukums *</Label>
              <Input id="k-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Sprinta ātrums" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="k-target">Mērķis *</Label>
                <Input id="k-target" type="number" step="any" value={form.target} onChange={(e) => setField("target", e.target.value)} placeholder="100" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="k-current">Pašreizējais</Label>
                <Input id="k-current" type="number" step="any" value={form.current} onChange={(e) => setField("current", e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="k-unit">Vienība</Label>
                <Input id="k-unit" value={form.unit} onChange={(e) => setField("unit", e.target.value)} placeholder="%" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tendence</Label>
                <Select value={form.trend} onValueChange={(v) => setField("trend", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">Pieaug</SelectItem>
                    <SelectItem value="down">Samazinās</SelectItem>
                    <SelectItem value="stable">Stabils</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="k-period">Periods</Label>
                <Input id="k-period" value={form.period} onChange={(e) => setField("period", e.target.value)} placeholder="Q2 2026" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Īpašnieks</Label>
              <Select
                value={form.owner_id || "none"}
                onValueChange={(v) => setField("owner_id", v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Nav norādīts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nav norādīts</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.id.slice(0, 8)}{p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Atcelt</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saglabā…" : editingKpi ? "Saglabāt izmaiņas" : "Izveidot KPI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record value dialog ──────────────────────────────────────────── */}
      <Dialog open={!!recordingKpi} onOpenChange={(o) => { if (!o) setRecordingKpi(null) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Reģistrēt vērtību — {recordingKpi?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="rec-val">Jaunā vērtība{recordingKpi?.unit ? ` (${recordingKpi.unit})` : ""}</Label>
            <Input
              id="rec-val"
              type="number"
              step="any"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={String(recordingKpi?.current ?? "")}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Mērķis: {recordingKpi?.target}{recordingKpi?.unit ?? ""}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordingKpi(null)}>Atcelt</Button>
            <Button onClick={handleRecordValue} disabled={recording || !newValue}>
              {recording ? "Saglabā…" : "Reģistrēt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Dzēst KPI?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{deleteTarget?.name}</strong> un visi tā vēsturiskie dati tiks neatgriezeniski dzēsti.
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
