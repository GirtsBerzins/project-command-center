import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { encryptSettingValue, isSettingsEncryptionEnabled } from "@/lib/settings-crypto"

type Role = "owner" | "manager" | "member" | "viewer"

const SECRET_FIELDS = [
  "supabaseAnonKey",
  "supabaseServiceRoleKey",
  "googleClientSecret",
  "githubClientSecret",
  "smtpPassword",
] as const

const NON_SECRET_FIELDS = [
  "supabaseUrl",
  "googleClientId",
  "githubClientId",
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpFromEmail",
  "smtpFromName",
] as const

const ALL_FIELDS = [...NON_SECRET_FIELDS, ...SECRET_FIELDS] as const
type FieldName = (typeof ALL_FIELDS)[number]

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

function isAllowedRole(role: Role | null) {
  return role === "owner" || role === "manager"
}

export async function GET() {
  const { supabase, user, role } = await getCurrentUserAndRole()
  if (!user) {
    return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 })
  }
  if (!isAllowedRole(role)) {
    return NextResponse.json({ error: "Nav piekļuves iestatījumiem" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("integration_settings")
    .select("settings_json")
    .eq("id", 1)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const settings = (data?.settings_json ?? {}) as Record<string, unknown>
  const values: Record<string, string> = {}
  const configuredSecrets: Record<string, boolean> = {}

  for (const field of NON_SECRET_FIELDS) {
    values[field] = typeof settings[field] === "string" ? (settings[field] as string) : ""
  }
  for (const field of SECRET_FIELDS) {
    values[field] = ""
    configuredSecrets[field] = typeof settings[field] === "string" && (settings[field] as string).length > 0
  }

  return NextResponse.json({
    values,
    configuredSecrets,
    encryptionEnabled: isSettingsEncryptionEnabled(),
  })
}

export async function PUT(request: Request) {
  const { supabase, user, role } = await getCurrentUserAndRole()
  if (!user) {
    return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 })
  }
  if (!isAllowedRole(role)) {
    return NextResponse.json({ error: "Nav piekļuves iestatījumiem" }, { status: 403 })
  }

  const payload = (await request.json()) as Partial<Record<FieldName, string>>
  const { data: current, error: readError } = await supabase
    .from("integration_settings")
    .select("settings_json")
    .eq("id", 1)
    .maybeSingle()
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 })
  }

  const existing = ((current?.settings_json ?? {}) as Record<string, unknown>)
  const nextSettings: Record<string, string> = {}

  // Keep existing values unless explicitly overridden.
  for (const field of ALL_FIELDS) {
    const existingValue = existing[field]
    nextSettings[field] = typeof existingValue === "string" ? existingValue : ""
  }

  for (const field of NON_SECRET_FIELDS) {
    if (typeof payload[field] === "string") {
      nextSettings[field] = payload[field]!.trim()
    }
  }

  for (const field of SECRET_FIELDS) {
    const value = payload[field]
    if (typeof value === "string" && value.trim().length > 0) {
      nextSettings[field] = encryptSettingValue(value.trim())
    }
  }

  const { error: upsertError } = await supabase
    .from("integration_settings")
    .upsert({
      id: 1,
      settings_json: nextSettings,
      encrypted_fields: isSettingsEncryptionEnabled() ? [...SECRET_FIELDS] : [],
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    encryptionEnabled: isSettingsEncryptionEnabled(),
  })
}
