"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckCircle2, AlertTriangle, Clock, Zap, Download, Save, FileText,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────
interface CompletedTask {
  id: string; title: string
  profiles: { full_name: string | null } | null
  streams: { name: string } | null
}

interface DelayedTask {
  id: string; title: string; due_date: string; priority: string
  profiles: { full_name: string | null } | null
  streams: { name: string } | null
}

interface Risk {
  id: string; title: string; impact: string; probability: string
  status: string; due_date: string | null
}

interface SprintTask { tasks: { status: string } }
interface ActiveSprint {
  id: string; name: string; end_date: string
  task_sprint: SprintTask[]
}

interface SavedReport {
  id: string; week_start: string; week_end: string
  content_md: string | null; created_at: string
}

// ─── Markdown generator ───────────────────────────────────────────────────────
function generateMarkdown(
  weekStart: string,
  weekEnd: string,
  completedTasks: CompletedTask[],
  delayedTasks: DelayedTask[],
  openRisks: Risk[],
  activeSprint: ActiveSprint | null,
): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("lv-LV", { dateStyle: "medium" })

  const highRisks = openRisks.filter((r) => r.impact === "high")

  let sprintSection = "Nav aktīva sprinta."
  if (activeSprint) {
    const tasks = activeSprint.task_sprint.map((ts) => ts.tasks)
    const total = tasks.length
    const done  = tasks.filter((t) => t.status === "done").length
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0
    sprintSection = `**${activeSprint.name}** — ${done}/${total} uzdevumi pabeigti (${pct}%)  \nBeidzas ${fmt(activeSprint.end_date)}`
  }

  const nextWeekFocus = [
    delayedTasks.length > 0 && `Atrisināt ${delayedTasks.length} nokavēt${delayedTasks.length > 1 ? "us" : "u"} uzdevum${delayedTasks.length > 1 ? "us" : "u"}`,
    highRisks.length > 0   && `Mazināt ${highRisks.length} augst${highRisks.length > 1 ? "as" : "as"} ietekmes risk${highRisks.length > 1 ? "us" : "u"}`,
    activeSprint           && `Pabeigt sprintu: ${activeSprint.name}`,
  ].filter(Boolean)

  return `# Nedēļas atskaite — ${fmt(weekStart)} līdz ${fmt(weekEnd)}

## Sprinta veselība
${sprintSection}

## Pabeigti šonedēļ (${completedTasks.length})
${completedTasks.length === 0
  ? "_Šonedēļ nav pabeigtu uzdevumu._"
  : completedTasks.map((t) =>
    `- **${t.title}**${t.streams ? ` _(${t.streams.name})_` : ""}${t.profiles?.full_name ? ` — ${t.profiles.full_name}` : ""}`
  ).join("\n")}

## Nokavētie uzdevumi (${delayedTasks.length})
${delayedTasks.length === 0
  ? "_Nav nokavētu uzdevumu._"
  : delayedTasks.map((t) =>
    `- **${t.title}** [${t.priority}]${t.streams ? ` _(${t.streams.name})_` : ""} — termiņš ${fmt(t.due_date)}${t.profiles?.full_name ? ` (${t.profiles.full_name})` : ""}`
  ).join("\n")}

## Galvenie riski (${openRisks.length} atvērti)
${openRisks.length === 0
  ? "_Nav atvērtu risku._"
  : openRisks.slice(0, 5).map((r) =>
    `- **${r.title}** — ietekme: ${r.impact}, varbūtība: ${r.probability}${r.due_date ? `, termiņš ${fmt(r.due_date)}` : ""}`
  ).join("\n")}

## Nākamās nedēļas fokusu
${nextWeekFocus.length === 0
  ? "_Saglabāt pašreizējo tempu._"
  : nextWeekFocus.map((f) => `- ${f}`).join("\n")}

---
_Ģenerēts ${new Date().toLocaleString("lv-LV", { dateStyle: "medium", timeStyle: "short" })}_
`
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  completedTasks: CompletedTask[]
  delayedTasks: DelayedTask[]
  openRisks: Risk[]
  activeSprint: ActiveSprint | null
  savedReports: SavedReport[]
  weekStart: string
  weekEnd: string
}

export function ReportsClient({
  completedTasks, delayedTasks, openRisks,
  activeSprint, savedReports, weekStart, weekEnd,
}: Props) {
  const supabase = createClient()

  const [reports, setReports]   = useState<SavedReport[]>(savedReports)
  const [saving, setSaving]     = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const md = generateMarkdown(weekStart, weekEnd, completedTasks, delayedTasks, openRisks, activeSprint)

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("lv-LV", { dateStyle: "medium" })

  const sprintTasks = activeSprint?.task_sprint.map((ts) => ts.tasks) ?? []
  const sprintDone  = sprintTasks.filter((t) => t.status === "done").length
  const sprintTotal = sprintTasks.length
  const sprintPct   = sprintTotal > 0 ? Math.round((sprintDone / sprintTotal) * 100) : 0

  // ── Export markdown ────────────────────────────────────────────────────────
  function handleExport() {
    const blob = new Blob([md], { type: "text/markdown" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `nedelas-atskaite-${weekStart}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Save to DB ─────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    const { data, error } = await supabase
      .from("weekly_reports")
      .upsert(
        { week_start: weekStart, week_end: weekEnd, content_md: md },
        { onConflict: "week_start" }
      )
      .select()
      .single()

    if (!error && data) {
      setReports((prev) => {
        const exists = prev.find((r) => r.week_start === weekStart)
        return exists
          ? prev.map((r) => r.week_start === weekStart ? { ...r, content_md: md } : r)
          : [data as SavedReport, ...prev]
      })
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 3000)
    }
    setSaving(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Atskaites</h1>
          <p className="text-sm text-muted-foreground">
            Nedēļa no {fmt(weekStart)} — {fmt(weekEnd)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Eksportēt .md
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saglabā…" : savedMsg ? "Saglabāts!" : "Saglabāt atskaiti"}
          </Button>
        </div>
      </div>

      {/* Summary widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Pabeigti šonedēļ</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-400">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{delayedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Nokavētie uzdevumi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-400">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{openRisks.length}</p>
                <p className="text-xs text-muted-foreground">Atvērtie riski</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{sprintPct}%</p>
                <p className="text-xs text-muted-foreground">
                  {activeSprint ? activeSprint.name : "Nav aktīva sprinta"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Priekšskatījums</TabsTrigger>
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="history">Vēsture ({reports.length})</TabsTrigger>
        </TabsList>

        {/* ── Preview tab ─────────────────────────────────────────────── */}
        <TabsContent value="preview" className="space-y-4 mt-4">
          {/* Completed tasks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Pabeigti šonedēļ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Šonedēļ nav pabeigtu uzdevumu.</p>
              ) : (
                <div className="space-y-1.5">
                  {completedTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <span className="flex-1">{t.title}</span>
                      {t.streams && <span className="text-xs text-muted-foreground">{t.streams.name}</span>}
                      {t.profiles?.full_name && <span className="text-xs text-muted-foreground">{t.profiles.full_name}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delayed tasks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-500" />
                Nokavētie uzdevumi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {delayedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nav nokavētu uzdevumu.</p>
              ) : (
                <div className="space-y-1.5">
                  {delayedTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="flex-1">{t.title}</span>
                      <Badge variant={t.priority === "critical" ? "destructive" : "outline"} className="text-xs h-5">
                        {t.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">termiņš {fmt(t.due_date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top risks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Galvenie riski
              </CardTitle>
            </CardHeader>
            <CardContent>
              {openRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nav atvērtu risku.</p>
              ) : (
                <div className="space-y-2">
                  {openRisks.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p>{r.title}</p>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${r.impact === "high" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {r.impact} ietekme
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {r.probability} varbūt.
                          </span>
                        </div>
                      </div>
                      {r.due_date && (
                        <span className="text-xs text-muted-foreground shrink-0">termiņš {fmt(r.due_date)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Markdown tab ────────────────────────────────────────────── */}
        <TabsContent value="markdown" className="mt-4">
          <div className="relative">
            <Button
              size="sm" variant="outline"
              className="absolute top-2 right-2 h-7 text-xs"
              onClick={() => navigator.clipboard.writeText(md)}
            >
              Kopēt
            </Button>
            <pre className="rounded-lg border bg-muted p-4 text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
              {md}
            </pre>
          </div>
        </TabsContent>

        {/* ── History tab ─────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          {reports.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Vēl nav saglabātu atskaišu.</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <Card key={r.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            Nedēļa no {fmt(r.week_start)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Saglabāts {new Date(r.created_at).toLocaleString("lv-LV", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => {
                          const blob = new Blob([r.content_md ?? ""], { type: "text/markdown" })
                          const url  = URL.createObjectURL(blob)
                          const a    = document.createElement("a")
                          a.href     = url
                          a.download = `nedelas-atskaite-${r.week_start}.md`
                          a.click()
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Lejupielādēt
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
