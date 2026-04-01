"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

type Dep = { task_id: string; depends_on_task_id: string; type: "sequential" | "parallel" }

export interface GanttTask {
  id: string
  title: string
  status: string
  calculated_start_date: string | null
  calculated_end_date: string | null
  start_date: string | null
  due_date: string | null
}

export interface GanttMilestone {
  id: string
  title: string
  due_date: string | null
}

function parseDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

function formatDay(day: number): string {
  const d = new Date(day * 86400000)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, delta: number): string {
  return formatDay(parseDay(iso) + delta)
}

function barRange(t: GanttTask): { start: string; end: string } | null {
  const s = t.calculated_start_date ?? t.start_date
  const e = t.calculated_end_date ?? t.due_date ?? s
  if (!s || !e) return null
  return parseDay(e) >= parseDay(s) ? { start: s, end: e } : { start: e, end: s }
}

function classifyScheduling(tid: string, deps: Dep[]): "parallel" | "sequential" {
  const incoming = deps.filter((d) => d.task_id === tid)
  if (incoming.length === 0) return "sequential"
  if (incoming.every((d) => d.type === "parallel")) return "parallel"
  return "sequential"
}

function barColor(t: GanttTask, deps: Dep[], critical: Set<string>): string {
  if (t.status === "done") return "#22c55e"
  if (critical.has(t.id)) return "#ef4444"
  return classifyScheduling(t.id, deps) === "parallel" ? "#3b82f6" : "#f97316"
}

export function TasksGantt(props: {
  tasks: GanttTask[]
  dependencies: Dep[]
  milestones: GanttMilestone[]
  criticalPathIds: Set<string>
  onTaskDragEnd: (taskId: string, newStartDate: string) => Promise<void>
}) {
  const { tasks, dependencies, milestones, criticalPathIds, onTaskDragEnd } = props
  const pxPerDay = 28
  const rowH = 36
  const headerH = 28
  const leftW = 200

  const arrowId = useId().replace(/:/g, "")
  const [drag, setDrag] = useState<{ taskId: string; originX: number; startIso: string } | null>(null)

  const { minD, maxD, days, dayLabels } = useMemo(() => {
    let lo = parseDay(new Date().toISOString().slice(0, 10))
    let hi = lo + 30
    for (const t of tasks) {
      const r = barRange(t)
      if (r) {
        lo = Math.min(lo, parseDay(r.start))
        hi = Math.max(hi, parseDay(r.end))
      }
    }
    for (const m of milestones) {
      if (m.due_date) {
        const d = parseDay(m.due_date)
        lo = Math.min(lo, d)
        hi = Math.max(hi, d)
      }
    }
    lo -= 2
    hi += 7
    const n = hi - lo + 1
    const labels: string[] = []
    for (let i = 0; i < n; i++) {
      labels.push(formatDay(lo + i))
    }
    return { minD: lo, maxD: hi, days: n, dayLabels: labels }
  }, [tasks, milestones])

  const svgW = days * pxPerDay
  const svgH = headerH + tasks.length * rowH + milestones.length * rowH

  const taskIndex = useMemo(() => new Map(tasks.map((t, i) => [t.id, i])), [tasks])
  const posById = useMemo(() => {
    const m = new Map<string, { x1: number; x2: number; y: number }>()
    for (const t of tasks) {
      const r = barRange(t)
      const i = taskIndex.get(t.id) ?? 0
      if (!r) continue
      const x1 = (parseDay(r.start) - minD) * pxPerDay
      const x2 = (parseDay(r.end) - minD + 1) * pxPerDay
      const y = headerH + i * rowH + rowH / 2
      m.set(t.id, { x1, x2, y })
    }
    return m
  }, [tasks, taskIndex, minD, headerH, rowH])

  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!drag) return
    const d = drag
    const up = (e: MouseEvent) => {
      const dx = e.clientX - d.originX
      const deltaDays = Math.round(dx / pxPerDay)
      const newStart = addDays(d.startIso, deltaDays)
      setDrag(null)
      void onTaskDragEnd(d.taskId, newStart)
    }
    window.addEventListener("mouseup", up)
    return () => window.removeEventListener("mouseup", up)
  }, [drag, onTaskDragEnd, pxPerDay])

  const arrows = useMemo(() => {
    const paths: { d: string; key: string }[] = []
    for (const d of dependencies) {
      const a = posById.get(d.depends_on_task_id)
      const b = posById.get(d.task_id)
      if (!a || !b) continue
      const x1 = a.x2
      const y1 = a.y
      const x2 = b.x1
      const y2 = b.y
      const mid = (x1 + x2) / 2
      const dPath = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
      paths.push({ d: dPath, key: `${d.depends_on_task_id}-${d.task_id}` })
    }
    return paths
  }, [dependencies, posById])

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground py-8">Nav uzdevumu ar datumiem — pievienojiet grafiku vai atlasiet projektu.</p>
  }

  return (
    <div className="border rounded-lg overflow-auto bg-background">
      <svg
        ref={svgRef}
        width={leftW + svgW}
        height={svgH}
        className="block"
        role="img"
        aria-label="Ganta diagramma"
      >
        <rect x={0} y={0} width={leftW} height={svgH} fill="hsl(var(--muted))" opacity={0.35} />
        {tasks.map((t, i) => (
          <text
            key={t.id}
            x={8}
            y={headerH + i * rowH + rowH / 2 + 4}
            className="text-[11px] fill-foreground"
            style={{ fontFamily: "inherit" }}
          >
            {t.title.length > 28 ? `${t.title.slice(0, 26)}…` : t.title}
          </text>
        ))}
        {milestones.map((m, mi) => (
          <text
            key={`ml-${m.id}`}
            x={8}
            y={headerH + (tasks.length + mi) * rowH + rowH / 2 + 4}
            className="text-[11px] fill-foreground"
            style={{ fontFamily: "inherit" }}
          >
            ◆ {m.title.length > 24 ? `${m.title.slice(0, 22)}…` : m.title}
          </text>
        ))}
        <g transform={`translate(${leftW},0)`}>
          {dayLabels.map((_, di) => (
            <line
              key={di}
              x1={di * pxPerDay}
              y1={0}
              x2={di * pxPerDay}
              y2={svgH}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
            />
          ))}
          {arrows.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.2}
              markerEnd={`url(#arrowhead-${arrowId})`}
            />
          ))}
          <defs>
            <marker id={`arrowhead-${arrowId}`} markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="hsl(var(--muted-foreground))" />
            </marker>
          </defs>
          {tasks.map((t, i) => {
            const r = barRange(t)
            if (!r) return null
            const x1 = (parseDay(r.start) - minD) * pxPerDay + 2
            const w = (parseDay(r.end) - parseDay(r.start) + 1) * pxPerDay - 4
            const y = headerH + i * rowH + 6
            const h = rowH - 12
            const fill = barColor(t, dependencies, criticalPathIds)
            return (
              <rect
                key={`bar-${t.id}`}
                x={x1}
                y={y}
                width={Math.max(w, 6)}
                height={h}
                rx={4}
                fill={fill}
                opacity={0.9}
                className="cursor-grab"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setDrag({
                    taskId: t.id,
                    originX: e.clientX,
                    startIso: r.start,
                  })
                }}
              />
            )
          })}
          {milestones.map((m, mi) => {
            if (!m.due_date) return null
            const cx = (parseDay(m.due_date) - minD) * pxPerDay + pxPerDay / 2
            const cy = headerH + (tasks.length + mi) * rowH + rowH / 2
            const s = 10
            return (
              <polygon
                key={m.id}
                points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
                fill="#a855f7"
                stroke="#7e22ce"
                strokeWidth={1}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
