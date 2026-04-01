/**
 * CPM-style scheduling: forward/backward pass, critical path, dependency conflicts.
 * Dates are YYYY-MM-DD (UTC calendar semantics).
 */

export type ScheduleTaskInput = {
  id: string
  estimate_hours: number | null
  start_date: string | null
  due_date: string | null
  manual_override: boolean
}

export type ScheduleDepInput = {
  task_id: string
  depends_on_task_id: string
  type: "sequential" | "parallel"
}

export type TaskScheduleRow = {
  calculated_start_date: string
  calculated_end_date: string
  schedule_conflict: boolean
}

function parseDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

function formatDay(day: number): string {
  const d = new Date(day * 86400000)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0")
  const da = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

function maxDay(a: string, b: string): string {
  return parseDay(a) >= parseDay(b) ? a : b
}

/** Inclusive span: start + (durationDays - 1) */
function endFromStart(start: string, durationDays: number): string {
  const s = parseDay(start)
  return formatDay(s + durationDays - 1)
}

export function durationDaysForTask(t: ScheduleTaskInput): number {
  if (t.estimate_hours != null && t.estimate_hours > 0) {
    return Math.max(1, Math.ceil(Number(t.estimate_hours) / 8))
  }
  if (t.start_date && t.due_date) {
    const a = parseDay(t.start_date)
    const b = parseDay(t.due_date)
    return Math.max(1, Math.round(b - a) + 1)
  }
  return 1
}

function sequentialPredecessors(taskId: string, deps: ScheduleDepInput[]): string[] {
  return deps.filter((d) => d.task_id === taskId && d.type === "sequential").map((d) => d.depends_on_task_id)
}

function hasParallelIncoming(taskId: string, deps: ScheduleDepInput[]): boolean {
  return deps.some((d) => d.task_id === taskId && d.type === "parallel")
}

/** Topological order: predecessors before successors (sequential edges only). */
function topologicalOrder(taskIds: string[], deps: ScheduleDepInput[]): string[] | null {
  const idSet = new Set(taskIds)
  const adj = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  for (const id of taskIds) {
    adj.set(id, [])
    indeg.set(id, 0)
  }
  for (const d of deps) {
    if (d.type !== "sequential") continue
    if (!idSet.has(d.task_id) || !idSet.has(d.depends_on_task_id)) continue
    const a = d.depends_on_task_id
    const b = d.task_id
    adj.get(a)!.push(b)
    indeg.set(b, (indeg.get(b) ?? 0) + 1)
  }
  const q: string[] = []
  for (const id of taskIds) {
    if ((indeg.get(id) ?? 0) === 0) q.push(id)
  }
  const out: string[] = []
  while (q.length) {
    const u = q.shift()!
    out.push(u)
    for (const v of adj.get(u) ?? []) {
      const k = (indeg.get(v) ?? 0) - 1
      indeg.set(v, k)
      if (k === 0) q.push(v)
    }
  }
  if (out.length !== taskIds.length) return null
  return out
}

export function computeTaskSchedule(options: {
  projectStart: string
  tasks: ScheduleTaskInput[]
  dependencies: ScheduleDepInput[]
}): {
  updates: Record<string, TaskScheduleRow>
  criticalPathIds: string[]
} {
  const { projectStart, tasks, dependencies } = options
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const taskIds = tasks.map((t) => t.id)
  const D = new Map<string, number>()
  for (const t of tasks) D.set(t.id, durationDaysForTask(t))

  const order = topologicalOrder(taskIds, dependencies)
  const useOrder = order ?? [...taskIds].sort()

  const ES = new Map<string, string>()
  const EF = new Map<string, string>()

  function forwardPass() {
    for (const id of useOrder) {
      const t = taskById.get(id)!
      let es = projectStart
      if (hasParallelIncoming(id, dependencies)) {
        es = maxDay(es, projectStart)
      }
      for (const p of sequentialPredecessors(id, dependencies)) {
        const ef = EF.get(p)
        if (ef) es = maxDay(es, ef)
      }
      if (t.manual_override && t.start_date) {
        es = t.start_date
      }
      ES.set(id, es)
      EF.set(id, endFromStart(es, D.get(id) ?? 1))
    }
  }

  if (order) {
    forwardPass()
  } else {
    for (let i = 0; i < Math.max(30, taskIds.length * 3); i++) {
      forwardPass()
    }
  }

  let projectEndDay = parseDay(projectStart)
  for (const id of taskIds) {
    projectEndDay = Math.max(projectEndDay, parseDay(EF.get(id)!))
  }
  const projectEnd = formatDay(projectEndDay)

  const LF = new Map<string, string>()
  for (const id of taskIds) LF.set(id, projectEnd)

  const LS = new Map<string, string>()

  function backwardPass(reverseList: string[], carryLf: boolean) {
    for (const id of reverseList) {
      const dur = D.get(id) ?? 1
      let lf = carryLf ? LF.get(id)! : projectEnd
      for (const d of dependencies) {
        if (d.type !== "sequential") continue
        if (d.depends_on_task_id !== id) continue
        const succLs = LS.get(d.task_id)
        if (succLs != null) lf = minDayStr(lf, succLs)
      }
      LF.set(id, lf)
      LS.set(id, formatDay(parseDay(lf) - dur + 1))
    }
  }

  const reverseTopo = [...useOrder].reverse()
  if (order) {
    backwardPass(reverseTopo, false)
  } else {
    for (const id of taskIds) LF.set(id, projectEnd)
    for (let i = 0; i < Math.max(30, taskIds.length * 3); i++) {
      backwardPass(reverseTopo, true)
    }
  }

  const criticalPathIds: string[] = []
  const updates: Record<string, TaskScheduleRow> = {}

  for (const id of taskIds) {
    const es = ES.get(id)!
    const ls = LS.get(id)!
    const slack = parseDay(ls) - parseDay(es)
    if (Math.abs(slack) < 0.5) criticalPathIds.push(id)

    const t = taskById.get(id)!
    let reqStart = projectStart
    for (const p of sequentialPredecessors(id, dependencies)) {
      const ef = EF.get(p)
      if (ef) reqStart = maxDay(reqStart, ef)
    }
    const conflict =
      t.manual_override &&
      !!t.start_date &&
      parseDay(t.start_date) < parseDay(reqStart)

    updates[id] = {
      calculated_start_date: es,
      calculated_end_date: EF.get(id)!,
      schedule_conflict: conflict,
    }
  }

  return { updates, criticalPathIds }
}

function minDayStr(a: string, b: string): string {
  return parseDay(a) <= parseDay(b) ? a : b
}
