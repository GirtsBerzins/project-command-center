"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Task } from "./tasks-client"

interface Stream {
  id: string
  name: string
}
interface Profile {
  id: string
  full_name: string | null
  email?: string | null
}

const STATUS_OPTS = [
  { id: "todo", label: "Darāmais" },
  { id: "in_progress", label: "Procesā" },
  { id: "review", label: "Pārskatāmais" },
  { id: "done", label: "Pabeigts" },
]

export function TasksTableBulk(props: {
  tasks: Task[]
  streams: Stream[]
  profiles: Profile[]
  myRole?: "owner" | "manager" | "member" | "viewer"
  onChanged: () => void
}) {
  const { tasks, streams, profiles, myRole, onChanged } = props
  const supabase = createClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [working, setWorking] = useState(false)

  const canDelete = myRole === "owner" || myRole === "manager"

  const visible = useMemo(() => {
    if (statusFilter === "all") return tasks
    return tasks.filter((t) => t.status === statusFilter)
  }, [tasks, statusFilter])

  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id))

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visible.map((t) => t.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const ids = [...selected]

  async function bulkUpdate(patch: Record<string, unknown>) {
    if (ids.length === 0) return
    setWorking(true)
    await supabase.from("tasks").update(patch).in("id", ids)
    setWorking(false)
    setSelected(new Set())
    onChanged()
  }

  async function bulkDelete() {
    if (ids.length === 0 || !canDelete) return
    setWorking(true)
    await supabase.from("milestone_tasks").delete().in("task_id", ids)
    await supabase.from("task_dependencies").delete().in("task_id", ids)
    await supabase.from("task_dependencies").delete().in("depends_on_task_id", ids)
    await supabase.from("tasks").delete().in("id", ids)
    setWorking(false)
    setSelected(new Set())
    setBulkDeleteOpen(false)
    onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Statusa filtrs</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            {STATUS_OPTS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
          <span className="text-xs font-medium mr-2">{ids.length} atlasīti</span>
          <Button size="sm" variant="secondary" className="h-7 text-xs" disabled={working} onClick={() => bulkUpdate({ status: "done" })}>
            Atzīmēt kā pabeigtus
          </Button>
          <Select onValueChange={(v) => bulkUpdate({ assignee_id: v === "__none" ? null : v })}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <span className="truncate">Mainīt izpildītāju</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nav</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name ?? p.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkUpdate({ priority: v })}>
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <span>Prioritāte</span>
            </SelectTrigger>
            <SelectContent>
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkUpdate({ stream_id: v === "__none" ? null : v })}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <span>Straume</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nav</SelectItem>
              {streams.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canDelete && (
            <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={working} onClick={() => setBulkDeleteOpen(true)}>
              Dzēst
            </Button>
          )}
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="rounded border"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  aria-label="Atlasīt visus"
                />
              </TableHead>
              <TableHead>Nosaukums</TableHead>
              <TableHead>Straume</TableHead>
              <TableHead>Izpildītājs</TableHead>
              <TableHead>Prioritāte</TableHead>
              <TableHead>Statuss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="rounded border"
                    checked={selected.has(t.id)}
                    onChange={() => toggleOne(t.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-sm max-w-[200px] truncate">{t.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.streams?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{t.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="text-xs">{t.priority}</TableCell>
                <TableCell className="text-xs">{STATUS_OPTS.find((s) => s.id === t.status)?.label ?? t.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dzēst {ids.length} uzdevumus?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Atcelt
            </Button>
            <Button variant="destructive" disabled={working} onClick={bulkDelete}>
              Dzēst
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
