import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

type Role = "owner" | "manager" | "member" | "viewer"
type MemberStatus = "active" | "pending"

type InviteBody = {
  email?: string
  full_name?: string
  role?: Role
  action?: "invite" | "resend"
}

async function getCurrentUserAndRole() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) return { supabase, user: null, role: null as Role | null }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return { supabase, user, role: (me?.role as Role | null) ?? null }
}

export async function GET() {
  try {
    const { supabase, user } = await getCurrentUserAndRole()
    if (!user) {
      return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 })
    }

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, avatar_url, created_at")
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const admin = createAdminClient()
    const usersById = new Map<string, MemberStatus>()
    let page = 1
    const perPage = 200

    while (true) {
      const { data: pageData, error: usersError } = await admin.auth.admin.listUsers({ page, perPage })
      if (usersError) {
        return NextResponse.json({ error: usersError.message }, { status: 400 })
      }

      const users = pageData.users ?? []
      for (const u of users) {
        usersById.set(u.id, u.email_confirmed_at ? "active" : "pending")
      }

      if (users.length < perPage) break
      page += 1
    }

    const members = (profiles ?? []).map((p) => ({
      ...p,
      status: usersById.get(p.id) ?? "pending",
    }))

    return NextResponse.json({ members })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Neizdevās ielādēt komandu" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { supabase, role } = await getCurrentUserAndRole()
  if (!role || !["owner", "manager"].includes(role)) {
    return NextResponse.json({ error: "Nav tiesību uzaicināt lietotājus" }, { status: 403 })
  }

  const body = (await request.json()) as InviteBody
  const action = body.action ?? "invite"
  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: "E-pasta adrese ir obligāta" }, { status: 400 })
  }

  if (action === "invite") {
    if (!body.full_name?.trim()) {
      return NextResponse.json({ error: "Vārds Uzvārds ir obligāts" }, { status: 400 })
    }
    if (!body.role) {
      return NextResponse.json({ error: "Loma ir obligāta" }, { status: 400 })
    }
    if (role === "manager" && !["member", "viewer"].includes(body.role)) {
      return NextResponse.json({ error: "Pārvaldnieks var uzaicināt tikai dalībnieku vai skatītāju" }, { status: 403 })
    }
  }

  try {
    const admin = createAdminClient()

    const inviteRole = action === "resend" ? undefined : body.role
    const inviteName = action === "resend" ? undefined : body.full_name?.trim()
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: inviteName ? { full_name: inviteName } : undefined,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Ensure profile has the expected data right after invite creation.
    // Invite flow creates auth user first; then we sync profile role/email/full_name.
    if (inviteRole && inviteName) {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const invited = (usersData.users ?? []).find((u) => u.email?.toLowerCase() === email)
      if (invited) {
        await supabase.from("profiles").upsert({
          id: invited.id,
          email,
          full_name: inviteName,
          role: inviteRole,
        })
      }
    }

    return NextResponse.json({ ok: true, email })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { supabase, user, role } = await getCurrentUserAndRole()
  if (!user || !role) {
    return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 })
  }

  const body = (await request.json()) as { userId?: string; role?: Role }
  const userId = body.userId
  const nextRole = body.role
  if (!userId || !nextRole) {
    return NextResponse.json({ error: "Nepilnīgi dati" }, { status: 400 })
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ error: "Lietotājs nav atrasts" }, { status: 404 })
  }

  const { count: ownerCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner")

  if (role === "owner") {
    // owner var mainīt jebkuru lomu, bet nedrīkst atstāt sistēmu bez īpašnieka
    if (target.role === "owner" && nextRole !== "owner" && (ownerCount ?? 0) <= 1) {
      return NextResponse.json({ error: "Sistēmā jāpaliek vismaz vienam īpašniekam" }, { status: 400 })
    }
  } else if (role === "manager") {
    const allowed = ["member", "viewer"]
    if (!allowed.includes(target.role) || !allowed.includes(nextRole)) {
      return NextResponse.json({ error: "Pārvaldnieks var mainīt tikai dalībnieku/skatītāju lomas" }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: "Nav tiesību mainīt lomas" }, { status: 403 })
  }

  if (role === "owner" && nextRole === "owner" && userId !== user.id) {
    // Owner-only transfer ownership:
    // promote target to owner, then demote current owner to manager.
    const { error: promoteError } = await supabase.from("profiles").update({ role: "owner" }).eq("id", userId)
    if (promoteError) return NextResponse.json({ error: promoteError.message }, { status: 400 })

    const { error: demoteError } = await supabase.from("profiles").update({ role: "manager" }).eq("id", user.id)
    if (demoteError) {
      return NextResponse.json({ error: demoteError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, transfer: true })
  }

  const { error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { role, user } = await getCurrentUserAndRole()
  if (!user || role !== "owner") {
    return NextResponse.json({ error: "Tikai īpašnieks var noņemt lietotājus" }, { status: 403 })
  }

  const body = (await request.json()) as { userId?: string }
  const userId = body.userId
  if (!userId) return NextResponse.json({ error: "Trūkst userId" }, { status: 400 })
  if (userId === user.id) {
    return NextResponse.json({ error: "Nevar noņemt sevi no komandas" }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

