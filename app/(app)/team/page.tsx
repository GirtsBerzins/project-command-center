"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pencil, Trash2, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Role = "owner" | "manager" | "member" | "viewer"
type MemberStatus = "active" | "pending"
interface TeamMember {
  id: string
  full_name: string | null
  email: string | null
  role: Role
  avatar_url: string | null
  status: MemberStatus
}

const ROLE_LABELS: Record<Role, string> = {
  owner: "Īpašnieks",
  manager: "Pārvaldnieks",
  member: "Dalībnieks",
  viewer: "Skatītājs",
}

function roleBadgeVariant(role: Role): "default" | "secondary" | "warning" {
  if (role === "owner") return "default"
  if (role === "manager") return "warning"
  return "secondary"
}

function initials(name: string | null, email: string | null) {
  if (name) return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return "?"
}

function displayName(member: TeamMember) {
  if (member.full_name?.trim()) return member.full_name
  if (member.email) return member.email.split("@")[0]
  return "Nezināms lietotājs"
}

export default function TeamPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<Role>("member")
  const [inviting, setInviting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null)
  const [nextRole, setNextRole] = useState<Role>("member")
  const [savingRole, setSavingRole] = useState(false)

  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [removing, setRemoving] = useState(false)

  const [myRole, setMyRole] = useState<Role | null>(null)

  async function readJsonSafe(res: Response) {
    const raw = await res.text()
    if (!raw) return {}
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  async function loadData() {
    setLoading(true)
    setError(null)
    const [{ data: me }, membersRes] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle(),
      fetch("/api/team"),
    ])
    setMyRole((me?.role as Role | null) ?? null)
    const payload = await readJsonSafe(membersRes)
    if (!membersRes.ok) {
      setError((payload.error as string | undefined) ?? "Neizdevās ielādēt komandu")
      setLoading(false)
      return
    }
    setMembers((payload.members as TeamMember[] | undefined) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canInvite = myRole === "owner" || myRole === "manager"
  const canEditRole = (target: TeamMember) => {
    if (myRole === "owner") return true
    if (myRole === "manager") return target.role === "member" || target.role === "viewer"
    return false
  }
  const canRemove = myRole === "owner"

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const rank: Record<Role, number> = { owner: 0, manager: 1, member: 2, viewer: 3 }
        if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role]
        return (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "", "lv")
      }),
    [members],
  )
  const currentOwnerId = useMemo(() => sortedMembers.find((m) => m.role === "owner")?.id ?? null, [sortedMembers])
  const canTransferOwnership = (target: TeamMember) => myRole === "owner" && target.id !== currentOwnerId

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) return
    setInviting(true)
    setError(null)
    setSuccess(null)
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "invite",
        full_name: inviteName,
        email: inviteEmail,
        role: inviteRole,
      }),
    })
    const payload = await readJsonSafe(res)
    setInviting(false)
    if (!res.ok) {
      setError((payload.error as string | undefined) ?? "Neizdevās uzaicināt")
      return
    }
    setInviteOpen(false)
    setInviteName("")
    setInviteEmail("")
    setInviteRole("member")
    setSuccess(`Uzaicinājums nosūtīts uz ${(payload.email as string | undefined) ?? inviteEmail}`)
    await loadData()
  }

  async function handleResend(email: string) {
    setError(null)
    setSuccess(null)
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend", email }),
    })
    const payload = await readJsonSafe(res)
    if (!res.ok) {
      setError((payload.error as string | undefined) ?? "Neizdevās atkārtoti nosūtīt uzaicinājumu")
      return
    }
    setSuccess(`Uzaicinājums nosūtīts uz ${(payload.email as string | undefined) ?? email}`)
  }

  async function handleUpdateRole() {
    if (!roleTarget) return
    setSavingRole(true)
    const res = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: roleTarget.id, role: nextRole }),
    })
    const payload = await readJsonSafe(res)
    setSavingRole(false)
    if (!res.ok) {
      setError((payload.error as string | undefined) ?? "Neizdevās atjaunināt lomu")
      return
    }
    if (payload.transfer) {
      setSuccess("Īpašumtiesības nodotas. Jūsu loma nomainīta uz Pārvaldnieks.")
      await loadData()
      setRoleTarget(null)
      return
    }
    setMembers((prev) => prev.map((m) => (m.id === roleTarget.id ? { ...m, role: nextRole } : m)))
    setRoleTarget(null)
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    const res = await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: removeTarget.id }),
    })
    const payload = await readJsonSafe(res)
    setRemoving(false)
    if (!res.ok) {
      setError((payload.error as string | undefined) ?? "Neizdevās noņemt lietotāju")
      return
    }
    setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id))
    setRemoveTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Komanda</h1>
          <p className="text-sm text-muted-foreground">{members.length} lietotāji komandā</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} disabled={!canInvite}>
          <Users className="h-4 w-4" />
          Uzaicināt lietotāju
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lietotājs</TableHead>
              <TableHead>E-pasts</TableHead>
              <TableHead>Loma</TableHead>
              <TableHead>Statuss</TableHead>
              <TableHead className="w-[96px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && sortedMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nav komandas dalībnieku.
                </TableCell>
              </TableRow>
            )}
            {sortedMembers.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.full_name ?? "Avatar"} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {initials(m.full_name, m.email)}
                      </span>
                    )}
                    <span className="font-medium">{displayName(m)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{m.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={roleBadgeVariant(m.role)}>{ROLE_LABELS[m.role]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.status === "active" ? "secondary" : "warning"}>
                      {m.status === "active" ? "Aktīvs" : "Gaida aktivizāciju"}
                    </Badge>
                    {m.status === "pending" && m.email && canInvite && (
                      <button
                        type="button"
                        className="text-xs text-primary underline underline-offset-2"
                        onClick={() => handleResend(m.email!)}
                      >
                        Atkārtoti nosūtīt
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canTransferOwnership(m)}
                      onClick={async () => {
                        setError(null)
                        setSuccess(null)
                        const res = await fetch("/api/team", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: m.id, role: "owner" }),
                        })
                        const payload = await readJsonSafe(res)
                        if (!res.ok) {
                          setError((payload.error as string | undefined) ?? "Neizdevās nodot īpašumtiesības")
                          return
                        }
                        setSuccess("Īpašumtiesības nodotas.")
                        await loadData()
                      }}
                    >
                      Nodot
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canEditRole(m)}
                      onClick={() => {
                        setRoleTarget(m)
                        setNextRole(m.role)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canRemove}
                      onClick={() => setRemoveTarget(m)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Uzaicināt jaunu komandas locekli</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="invite-name">Vārds Uzvārds</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jānis Bērziņš"
              />
            </div>
            <div className="space-y-1">
            <Label htmlFor="invite-email">E-pasta adrese</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="persona@uznemums.lv"
            />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">Loma</Label>
              <select
                id="invite-role"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                {myRole === "owner" && <option value="owner">Īpašnieks</option>}
                {myRole === "owner" && <option value="manager">Pārvaldnieks</option>}
                <option value="member">Dalībnieks</option>
                <option value="viewer">Skatītājs</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Atcelt</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}>
              {inviting ? "Sūta…" : "Nosūtīt uzaicinājumu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rediģēt lomu</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-1">
            <Label>Loma</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={nextRole}
              onChange={(e) => setNextRole(e.target.value as Role)}
            >
              {myRole === "owner" && <option value="owner">Īpašnieks</option>}
              <option value="manager">Pārvaldnieks</option>
              <option value="member">Dalībnieks</option>
              <option value="viewer">Skatītājs</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>Atcelt</Button>
            <Button onClick={handleUpdateRole} disabled={savingRole}>
              {savingRole ? "Saglabā…" : "Saglabāt izmaiņas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Noņemt no komandas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{removeTarget?.full_name ?? removeTarget?.email}</strong> tiks noņemts no komandas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Atcelt</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? "Noņem…" : "Noņemt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Darbība</TableHead>
              <TableHead>Īpašnieks</TableHead>
              <TableHead>Pārvaldnieks</TableHead>
              <TableHead>Dalībnieks</TableHead>
              <TableHead>Skatītājs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell>Skatīt visu</TableCell><TableCell>✅</TableCell><TableCell>✅</TableCell><TableCell>✅</TableCell><TableCell>✅</TableCell></TableRow>
            <TableRow><TableCell>Veidot uzdevumus</TableCell><TableCell>✅</TableCell><TableCell>✅</TableCell><TableCell>❌</TableCell><TableCell>❌</TableCell></TableRow>
            <TableRow><TableCell>Rediģēt savus uzdevumus</TableCell><TableCell>✅</TableCell><TableCell>✅</TableCell><TableCell>✅</TableCell><TableCell>❌</TableCell></TableRow>
            <TableRow><TableCell>Veidot sprintus/KPI</TableCell><TableCell>✅</TableCell><TableCell>✅</TableCell><TableCell>❌</TableCell><TableCell>❌</TableCell></TableRow>
            <TableRow><TableCell>Pārvaldīt komandu</TableCell><TableCell>✅</TableCell><TableCell>✅</TableCell><TableCell>❌</TableCell><TableCell>❌</TableCell></TableRow>
            <TableRow><TableCell>Dzēst datus</TableCell><TableCell>✅</TableCell><TableCell>❌</TableCell><TableCell>❌</TableCell><TableCell>❌</TableCell></TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

