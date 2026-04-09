"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

type StreamOpt = { id: string; name: string }
type ProfileOpt = { id: string; full_name: string | null; email?: string | null }
type TaskOpt = { id: string; title: string }

type TargetKey =
  | "_skip"
  | "project"
  | "name"
  | "description"
  | "estimated_hours"
  | "assignee"
  | "priority"
  | "status"
  | "stream"
  | "start_date"
  | "end_date"
  | "depends_on"
  | "parallel"

const TARGETS: { key: TargetKey; label: string; required?: boolean }[] = [
  { key: "_skip", label: "— ignorēt —" },
  { key: "project", label: "Projekts (nosaukums)" },
  { key: "name", label: "Nosaukums (virsraksts)", required: true },
  { key: "description", label: "Apraksts" },
  { key: "estimated_hours", label: "Plānotās stundas", required: true },
  { key: "assignee", label: "Izpildītājs (e-pasts)" },
  { key: "priority", label: "Prioritāte" },
  { key: "status", label: "Statuss" },
  { key: "stream", label: "Straume (nosaukums)" },
  { key: "start_date", label: "Sākuma datums" },
  { key: "end_date", label: "Beigu / termiņa datums" },
  { key: "depends_on", label: "Atkarīgs no (nosaukums)" },
  { key: "parallel", label: "Paralēls (jā/nē)" },
]

/** Veidne: pirmā rinda — instrukcijas, otrā — lauku nosaukumi (title, …). */
const IMPORT_TEMPLATE_INSTRUCTION_ROW = [
  "Projekta nosaukums; ja nav atrasts, importa laikā tiks izveidots automātiski.",
  "Obligāts. Īss uzdevuma nosaukums.",
  "Brīvas formas apraksts (nav obligāts).",
  "Straumes nosaukums; ja nav atrasta projektā, importa laikā tiks izveidota automātiski. Ja tukšs — bez straumes.",
  "Izpildītāja e-pasts (kā sistēmas profilā).",
  "Prioritāte: augsta / vidēja / zema vai high / medium / low / critical.",
  "Statuss: todo, in_progress, review, done.",
  "Sākuma datums: dd.mm.gggg vai YYYY-MM-DD.",
  "Termiņš: dd.mm.gggg vai YYYY-MM-DD.",
  "Plānotās stundas (skaitlis; importam obligāti jāaizpilda vai jākartē).",
  "Cita uzdevuma nosaukums (šajā failā vai jau sistēmā) priekštečam.",
  "Paralēla atkarība: jā vai nē (noklusējums — secīga).",
]

const IMPORT_TEMPLATE_HEADER_ROW = [
  "project",
  "title",
  "description",
  "stream",
  "assignee_email",
  "priority",
  "status",
  "start_date",
  "end_date",
  "estimated_hours",
  "depends_on",
  "parallel",
]

const IMPORT_TEMPLATE_EXAMPLE_ROWS: string[][] = [
  [
    "E-komercijas platforma",
    "Ārkārtas kļūdu labojums",
    "Novērst reģistrācijas kļūdu mobilajā skatā.",
    "Backend",
    "jana@piemers.lv",
    "augsta",
    "in_progress",
    "02.04.2026",
    "05.04.2026",
    "6",
    "",
    "nē",
  ],
  [
    "E-komercijas platforma",
    "API dokumentācija",
    "OpenAPI specifikācija un pieprasījumu piemēri.",
    "Backend",
    "",
    "vidēja",
    "todo",
    "",
    "15.04.2026",
    "12",
    "Ārkārtas kļūdu labojums",
    "nē",
  ],
  [
    "Mārketinga portāls",
    "Izvietošana staging",
    "Automātisks deploy un smoke testi.",
    "DevOps",
    "peteris@piemers.lv",
    "zema",
    "review",
    "10.04.2026",
    "11.04.2026",
    "3",
    "API dokumentācija",
    "jā",
  ],
]

function downloadImportTemplateXlsx() {
  const aoa = [IMPORT_TEMPLATE_INSTRUCTION_ROW, IMPORT_TEMPLATE_HEADER_ROW, ...IMPORT_TEMPLATE_EXAMPLE_ROWS]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!cols"] = IMPORT_TEMPLATE_HEADER_ROW.map(() => ({ wch: 30 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Uzdevumi")
  XLSX.writeFile(wb, "uzdevumu_importa_veidne.xlsx")
}

function gridHasTitleHeaderRow(row: string[]): boolean {
  return row.some((c) => String(c).trim().toLowerCase() === "title")
}

function splitInstructionsHeadersAndRows(grid: string[][]): { headers: string[]; dataRows: string[][] } | null {
  if (grid.length < 2) return null
  if (gridHasTitleHeaderRow(grid[1])) {
    const h = grid[1].map((c, i) => (String(c).trim() ? String(c).trim() : `Kolonna ${i + 1}`))
    return { headers: h, dataRows: grid.slice(2) }
  }
  const h = grid[0].map((c, i) => (String(c).trim() ? String(c).trim() : `Kolonna ${i + 1}`))
  return { headers: h, dataRows: grid.slice(1) }
}

function parseRawGrid(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const ab = e.target?.result
        if (!ab) {
          resolve([])
          return
        }
        const name = file.name.toLowerCase()
        if (name.endsWith(".csv")) {
          const text = new TextDecoder().decode(ab as ArrayBuffer)
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
          const rows = lines.map((line) => {
            const out: string[] = []
            let cur = ""
            let q = false
            for (let i = 0; i < line.length; i++) {
              const c = line[i]
              if (c === '"') {
                q = !q
              } else if ((c === "," && !q) || c === ";") {
                out.push(cur.trim())
                cur = ""
              } else {
                cur += c
              }
            }
            out.push(cur.trim())
            return out
          })
          resolve(rows)
          return
        }
        const wb = XLSX.read(ab, { type: "array" })
        const sh = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<string[]>(sh, { header: 1, defval: "" }) as string[][]
        resolve(rows.map((r) => r.map((c) => (c == null ? "" : String(c)).trim())))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error("Neizdevās nolasīt failu"))
    reader.readAsArrayBuffer(file)
  })
}

function normYes(v: string): boolean {
  const s = v.trim().toLowerCase()
  return s === "jā" || s === "ja" || s === "yes" || s === "y" || s === "1" || s === "true"
}

function normalizeDateCell(v: string): string | null {
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s)
  if (dm) {
    const day = Number(dm[1])
    const month = Number(dm[2])
    const year = Number(dm[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const check = new Date(`${iso}T12:00:00.000Z`)
      if (
        check.getUTCFullYear() === year &&
        check.getUTCMonth() + 1 === month &&
        check.getUTCDate() === day
      ) {
        return iso
      }
    }
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

/** Mapē latviešu / angļu prioritātes tekstu uz API vērtībām. */
function normalizePriorityForApi(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (["low", "medium", "high", "critical"].includes(s)) return s
  if (s.includes("augst") || s === "augsta") return "high"
  if (s.includes("krit")) return "critical"
  if (s.includes("vidēj") || s.includes("videj") || s.includes("vidēja")) return "medium"
  if (s.includes("zem") || s === "zema") return "low"
  return "medium"
}

export function TasksImportDialog(props: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Ja nav atlasīts projekts, importu nevar apstiprināt. */
  projectId: string | null
  streams: StreamOpt[]
  profiles: ProfileOpt[]
  existingTasks: TaskOpt[]
  onImported: () => void
}) {
  const { open, onOpenChange, projectId, streams, profiles, existingTasks, onImported } = props
  const canImport = Boolean(projectId)
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload")
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<number, TargetKey>>({})
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const emailToProfileId = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of profiles) {
      const em = p.email?.trim().toLowerCase()
      if (em) m.set(em, p.id)
    }
    return m
  }, [profiles])

  const streamNameToId = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of streams) {
      m.set(s.name.trim().toLowerCase(), s.id)
    }
    return m
  }, [streams])

  async function onFile(f: File | null) {
    if (!f) return
    setErr(null)
    setLoading(true)
    try {
      const grid = await parseRawGrid(f)
      const split = splitInstructionsHeadersAndRows(grid)
      if (!split || split.dataRows.length === 0) {
        setErr("Fails ir tukšs vai bez datu rindām (pēc virsraksta rindas).")
        setLoading(false)
        return
      }
      const { headers: h, dataRows } = split
      setHeaders(h)
      setRawRows(dataRows)
      const init: Record<number, TargetKey> = {}
      h.forEach((col, i) => {
        const low = col.toLowerCase()
        if (low.includes("project") || low.includes("projek"))
          init[i] = "project"
        else if (low === "title" || low.includes("name") || low.includes("nosauk") || low.includes("uzdev"))
          init[i] = "name"
        else if (low.includes("descr") || low.includes("aprakst"))
          init[i] = "description"
        else if (low.includes("hour") || low.includes("stund") || low.includes("estimate") || low.includes("laiks"))
          init[i] = "estimated_hours"
        else if (low.includes("mail") || low.includes("e-p") || low.includes("assign"))
          init[i] = "assignee"
        else if (low.includes("prior"))
          init[i] = "priority"
        else if (low.includes("status"))
          init[i] = "status"
        else if (low.includes("stream") || low.includes("straum"))
          init[i] = "stream"
        else if (low.includes("start"))
          init[i] = "start_date"
        else if (low.includes("end") || low.includes("due") || low.includes("term"))
          init[i] = "end_date"
        else if (low.includes("depend") || low.includes("atkar"))
          init[i] = "depends_on"
        else if (low.includes("parallel") || low.includes("paral"))
          init[i] = "parallel"
        else init[i] = "_skip"
      })
      setMapping(init)
      setStep("map")
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const preview = useMemo(() => {
    if (rawRows.length === 0) return []
    const colByTarget = new Map<TargetKey, number>()
    for (const [idxStr, key] of Object.entries(mapping)) {
      if (key === "_skip") continue
      colByTarget.set(key, Number(idxStr))
    }
    const need = (k: TargetKey) => colByTarget.get(k)

    const out: {
      tempId: string
      project_name: string | null
      title: string
      description: string | null
      estimate_hours: number
      assignee_id: string | null
      stream_id: string | null
      stream_name: string | null
      priority: string
      status: string
      start_date: string | null
      due_date: string | null
      dependsTitle: string | null
      parallelRaw: string | null
    }[] = []

    rawRows.forEach((row, ri) => {
      const projectCol = need("project")
      const nameCol = need("name")
      const hCol = need("estimated_hours")
      if (nameCol == null || hCol == null) return
      const project_name =
        projectCol != null && (row[projectCol] ?? "").trim() ? (row[projectCol] ?? "").trim() : null
      const title = (row[nameCol] ?? "").trim()
      const hoursRaw = (row[hCol] ?? "").trim().replace(",", ".")
      const hours = Number(hoursRaw)
      if (!title || Number.isNaN(hours)) return

      let assignee_id: string | null = null
      const ac = need("assignee")
      if (ac != null) {
        const em = (row[ac] ?? "").trim().toLowerCase()
        assignee_id = emailToProfileId.get(em) ?? null
      }

      let stream_id: string | null = null
      let stream_name: string | null = null
      const sc = need("stream")
      if (sc != null) {
        const streamRaw = (row[sc] ?? "").trim()
        if (streamRaw) {
          stream_name = streamRaw
          stream_id = streamNameToId.get(streamRaw.toLowerCase()) ?? null
        }
      }

      const pc = need("priority")
      const priority =
        pc != null && (row[pc] ?? "").trim() ? normalizePriorityForApi(row[pc] ?? "") : "medium"

      const stc = need("status")
      const status = stc != null ? (row[stc] ?? "").trim().toLowerCase() : "todo"

      const descCol = need("description")
      const description =
        descCol != null && (row[descCol] ?? "").trim() ? (row[descCol] ?? "").trim() : null

      const sdc = need("start_date")
      const start_date =
        sdc != null && (row[sdc] ?? "").trim()
          ? normalizeDateCell(row[sdc] ?? "")
          : null
      const edc = need("end_date")
      const due_date =
        edc != null && (row[edc] ?? "").trim()
          ? normalizeDateCell(row[edc] ?? "")
          : null

      const dc = need("depends_on")
      const dependsTitle = dc != null ? (row[dc] ?? "").trim() || null : null

      const pyc = need("parallel")
      const parallelRaw = pyc != null ? (row[pyc] ?? "").trim() || null : null

      out.push({
        tempId: `t${ri}`,
        project_name,
        title,
        description,
        estimate_hours: hours,
        assignee_id,
        stream_id,
        stream_name,
        priority,
        status,
        start_date,
        due_date,
        dependsTitle,
        parallelRaw,
      })
    })
    return out
  }, [rawRows, mapping, emailToProfileId, streamNameToId])

  const titleToPreviewTempId = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of preview) {
      m.set(p.title.trim().toLowerCase(), p.tempId)
    }
    return m
  }, [preview])

  const existingTitleToId = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of existingTasks) {
      m.set(t.title.trim().toLowerCase(), t.id)
    }
    return m
  }, [existingTasks])

  function mappingValid() {
    const vals = Object.values(mapping)
    return vals.includes("name") && vals.includes("estimated_hours")
  }

  const hasProjectMapping = Object.values(mapping).includes("project")
  const hasProjectValues = preview.some((p) => (p.project_name ?? "").trim().length > 0)
  const canSubmitImport = loading ? false : preview.length > 0 && (canImport || (hasProjectMapping && hasProjectValues))

  async function confirmImport() {
    if (!canImport && !(hasProjectMapping && hasProjectValues)) {
      setErr("Atlasiet projektu sānjoslā vai importa failā aizpildiet projekta kolonnu.")
      return
    }
    setErr(null)
    setLoading(true)
    try {
      const tasksPayload = preview.map((p) => ({
        temp_id: p.tempId,
        project_name: p.project_name,
        title: p.title,
        description: p.description,
        estimate_hours: p.estimate_hours,
        assignee_id: p.assignee_id,
        stream_id: p.stream_id,
        stream_name: p.stream_id ? null : p.stream_name,
        priority: normalizePriorityForApi(p.priority),
        status: p.status,
        start_date: p.start_date,
        due_date: p.due_date,
        manual_override: false,
      }))

      const dependencies: {
        task_temp_id: string
        type: "sequential" | "parallel"
        predecessor_temp_id?: string | null
        predecessor_task_id?: string | null
      }[] = []

      for (const p of preview) {
        if (!p.dependsTitle) continue
        const key = p.dependsTitle.trim().toLowerCase()
        const predTemp = titleToPreviewTempId.get(key)
        const predExisting = existingTitleToId.get(key)
        const parallel = p.parallelRaw != null ? normYes(p.parallelRaw) : false
        const type: "sequential" | "parallel" = parallel ? "parallel" : "sequential"
        if (predTemp) {
          dependencies.push({ task_temp_id: p.tempId, type, predecessor_temp_id: predTemp })
        } else if (predExisting) {
          dependencies.push({ task_temp_id: p.tempId, type, predecessor_task_id: predExisting })
        }
      }

      const res = await fetch("/api/tasks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_project_id: projectId, tasks: tasksPayload, dependencies }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Importa kļūda")
      onImported()
      onOpenChange(false)
      setStep("upload")
      setRawRows([])
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setStep("upload")
          setRawRows([])
          setErr(null)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importēt uzdevumus (CSV / Excel)</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-3">
            {!canImport && (
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                Lai importētu, atlasiet projektu sānjoslē (vai atveriet lapu ar atlasītu projektu). Veidni var
                lejupielādēt arī bez projekta.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Obligāti lauki pēc kartēšanas: nosaukums un plānotās stundas.
              {canImport
                ? " Ja projektu kolonna nav norādīta, tiks izmantots atlasītais projekts."
                : " Ja projekts nav atlasīts, failā jābūt projekta kolonnai ar nosaukumu katrai rindai."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto gap-2"
              onClick={() => downloadImportTemplateXlsx()}
            >
              <Download className="h-4 w-4" />
              Lejupielādēt veidni (.xlsx)
            </Button>
            <p className="text-xs text-muted-foreground">
              Veidnē pirmā rinda īsi apraksta kolonnas, otrā — lauku nosaukumi (title, description, …). Var dzēst
              piemēra rindas un aizpildīt savus datus; galvenais ir saglabāt otro rindu vai pielāgot kartēšanu.
            </p>
            <label
              htmlFor="tasks-import-file"
              className={cn(
                "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8",
                canImport ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed opacity-50 pointer-events-none",
              )}
            >
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm">
                {canImport ? "Izvēlieties .csv vai .xlsx" : "Vispirms atlasiet projektu"}
              </span>
              <input
                id="tasks-import-file"
                type="file"
                disabled={!canImport}
                accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {loading && <p className="text-sm">Nolasa…</p>}
          </div>
        )}

        {step === "map" && (
          <div className="space-y-3">
            <p className="text-sm">Katrai kolonnai izvēlieties lauku.</p>
            <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-1">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs w-40 truncate font-medium" title={h}>
                    {h}
                  </span>
                  <Select
                    value={mapping[i] ?? "_skip"}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [i]: v as TargetKey }))}
                  >
                    <SelectTrigger className="h-8 flex-1 min-w-[200px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGETS.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}
                          {t.required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {!mappingValid() && (
              <p className="text-sm text-destructive">Jānorāda vismaz nosaukuma un stundu kolonnas.</p>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Atpakaļ
              </Button>
              <Button disabled={!mappingValid()} onClick={() => setStep("preview")}>
                Priekšskatījums
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pirms apstiprināšanas pārbaudiet {preview.length} uzdevumus.
              {!canImport && " Bez atlasīta projekta jābūt aizpildītai projekta kolonnai importa failā."}
            </p>
            <div className="rounded-md border max-h-[45vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Projekts</TableHead>
                    <TableHead className="text-xs">Nosaukums</TableHead>
                    <TableHead className="text-xs">Apraksts</TableHead>
                    <TableHead className="text-xs">Stundas</TableHead>
                    <TableHead className="text-xs">Straume</TableHead>
                    <TableHead className="text-xs">Atkarīgs no</TableHead>
                    <TableHead className="text-xs">Tips</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p) => (
                    <TableRow key={p.tempId}>
                      <TableCell className="text-xs">{p.project_name ?? (projectId ? "Atlasītais projekts" : "—")}</TableCell>
                      <TableCell className="text-xs font-medium">{p.title}</TableCell>
                      <TableCell className="text-xs max-w-[140px] truncate" title={p.description ?? undefined}>
                        {p.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{p.estimate_hours}</TableCell>
                      <TableCell className="text-xs">
                        {p.stream_id
                          ? streams.find((s) => s.id === p.stream_id)?.name ?? p.stream_name ?? "—"
                          : p.stream_name
                            ? `${p.stream_name} (jauna)`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{p.dependsTitle ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {p.parallelRaw != null && normYes(p.parallelRaw) ? "Paralēls" : "Secīgs"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep("map")}>
                Atpakaļ
              </Button>
              <Button
                onClick={confirmImport}
                disabled={!canSubmitImport}
              >
                {loading ? "Importē…" : "Apstiprināt importu"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
