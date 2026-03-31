import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

type Role = "owner" | "manager" | "member" | "viewer"

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
  const { supabase, user } = await getCurrentUserAndRole()
  if (!user) {
    return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url, created_at")
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ members: data ?? [] })
}

export async function POST(request: Request) {
  const { role } = await getCurrentUserAndRole()
  if (!role || !["owner", "manager"].includes(role)) {
    return NextResponse.json({ error: "Nav tiesību uzaicināt lietotājus" }, { status: 403 })
  }

  const body = (await request.json()) as { email?: string }
  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: "E-pasta adrese ir obligāta" }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.inviteUserByEmail(email)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
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

  if (role === "owner") {
    // owner var mainīt jebkuru lomu
  } else if (role === "manager") {
    const allowed = ["member", "viewer"]
    if (!allowed.includes(target.role) || !allowed.includes(nextRole)) {
      return NextResponse.json({ error: "Pārvaldnieks var mainīt tikai dalībnieku/skatītāju lomas" }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: "Nav tiesību mainīt lomas" }, { status: 403 })
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

