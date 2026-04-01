"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type FormState = Record<string, string>
type SecretState = Record<string, boolean>

const DEFAULT_VALUES: FormState = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseServiceRoleKey: "",
  googleClientId: "",
  googleClientSecret: "",
  githubClientId: "",
  githubClientSecret: "",
  smtpHost: "",
  smtpPort: "",
  smtpUser: "",
  smtpPassword: "",
  smtpFromEmail: "",
  smtpFromName: "",
}

export function SettingsClient() {
  const [form, setForm] = useState<FormState>(DEFAULT_VALUES)
  const [configuredSecrets, setConfiguredSecrets] = useState<SecretState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/settings", { cache: "no-store" })
      const payload = (await res.json()) as {
        error?: string
        values?: FormState
        configuredSecrets?: SecretState
        encryptionEnabled?: boolean
      }
      if (!res.ok) {
        setError(payload.error ?? "Neizdevās ielādēt iestatījumus")
        setLoading(false)
        return
      }
      setForm({ ...DEFAULT_VALUES, ...(payload.values ?? {}) })
      setConfiguredSecrets(payload.configuredSecrets ?? {})
      setEncryptionEnabled(!!payload.encryptionEnabled)
      setLoading(false)
    })()
  }, [])

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setMessage(null)

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const payload = (await res.json()) as { ok?: boolean; error?: string; encryptionEnabled?: boolean }
    setSaving(false)
    if (!res.ok) {
      setError(payload.error ?? "Neizdevās saglabāt iestatījumus")
      return
    }

    setEncryptionEnabled(!!payload.encryptionEnabled)
    setConfiguredSecrets((prev) => ({
      ...prev,
      supabaseAnonKey: prev.supabaseAnonKey || !!form.supabaseAnonKey.trim(),
      supabaseServiceRoleKey: prev.supabaseServiceRoleKey || !!form.supabaseServiceRoleKey.trim(),
      googleClientSecret: prev.googleClientSecret || !!form.googleClientSecret.trim(),
      githubClientSecret: prev.githubClientSecret || !!form.githubClientSecret.trim(),
      smtpPassword: prev.smtpPassword || !!form.smtpPassword.trim(),
    }))
    setForm((prev) => ({
      ...prev,
      supabaseAnonKey: "",
      supabaseServiceRoleKey: "",
      googleClientSecret: "",
      githubClientSecret: "",
      smtpPassword: "",
    }))
    setMessage("Iestatījumi saglabāti.")
  }

  const secretNote = (key: keyof SecretState) =>
    configuredSecrets[key] ? "Atslēga jau saglabāta. Atstājiet tukšu, lai nemainītu." : "Vēl nav saglabāta."

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Iestatījumi</h1>
        <p className="text-sm text-muted-foreground">
          Pieejams tikai īpašniekam un pārvaldniekam.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {encryptionEnabled
            ? "Jutīgie lauki tiek šifrēti pirms saglabāšanas datubāzē."
            : "Jutīgo lauku šifrēšana nav ieslēgta (SETTINGS_ENCRYPTION_KEY nav uzstādīts)."}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supabase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Supabase URL</Label>
            <Input value={form.supabaseUrl} onChange={(e) => setField("supabaseUrl", e.target.value)} placeholder="https://xxxx.supabase.co" />
            <p className="text-xs text-muted-foreground">Supabase Dashboard → Project Settings → API → Project URL.</p>
          </div>
          <div className="space-y-1">
            <Label>Anon Key</Label>
            <Input value={form.supabaseAnonKey} onChange={(e) => setField("supabaseAnonKey", e.target.value)} placeholder="Ievadiet tikai, ja vēlaties nomainīt" />
            <p className="text-xs text-muted-foreground">Supabase Dashboard → Project Settings → API → anon public. {secretNote("supabaseAnonKey")}</p>
          </div>
          <div className="space-y-1">
            <Label>Service Role Key</Label>
            <Input value={form.supabaseServiceRoleKey} onChange={(e) => setField("supabaseServiceRoleKey", e.target.value)} placeholder="Ievadiet tikai, ja vēlaties nomainīt" />
            <p className="text-xs text-muted-foreground">Supabase Dashboard → Project Settings → API → service_role secret. {secretNote("supabaseServiceRoleKey")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google OAuth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Google Client ID</Label>
            <Input value={form.googleClientId} onChange={(e) => setField("googleClientId", e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" />
            <p className="text-xs text-muted-foreground">Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.</p>
          </div>
          <div className="space-y-1">
            <Label>Google Client Secret</Label>
            <Input value={form.googleClientSecret} onChange={(e) => setField("googleClientSecret", e.target.value)} placeholder="Ievadiet tikai, ja vēlaties nomainīt" />
            <p className="text-xs text-muted-foreground">Atveriet to pašu OAuth klientu Google Cloud un nokopējiet Secret. {secretNote("googleClientSecret")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GitHub OAuth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>GitHub Client ID</Label>
            <Input value={form.githubClientId} onChange={(e) => setField("githubClientId", e.target.value)} placeholder="Ov23..." />
            <p className="text-xs text-muted-foreground">GitHub → Settings → Developer settings → OAuth Apps.</p>
          </div>
          <div className="space-y-1">
            <Label>GitHub Client Secret</Label>
            <Input value={form.githubClientSecret} onChange={(e) => setField("githubClientSecret", e.target.value)} placeholder="Ievadiet tikai, ja vēlaties nomainīt" />
            <p className="text-xs text-muted-foreground">GitHub OAuth app iestatījumos izvēlieties Generate new client secret. {secretNote("githubClientSecret")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMTP E-pasts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>SMTP Host</Label>
              <Input value={form.smtpHost} onChange={(e) => setField("smtpHost", e.target.value)} placeholder="smtp.sendgrid.net" />
            </div>
            <div className="space-y-1">
              <Label>SMTP Port</Label>
              <Input value={form.smtpPort} onChange={(e) => setField("smtpPort", e.target.value)} placeholder="587" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>SMTP User</Label>
            <Input value={form.smtpUser} onChange={(e) => setField("smtpUser", e.target.value)} placeholder="apikey / lietotājs" />
          </div>
          <div className="space-y-1">
            <Label>SMTP Password</Label>
            <Input value={form.smtpPassword} onChange={(e) => setField("smtpPassword", e.target.value)} placeholder="Ievadiet tikai, ja vēlaties nomainīt" />
            <p className="text-xs text-muted-foreground">E-pasta pakalpojuma panelī (SendGrid/Mailgun/Resend/SMTP serveris). {secretNote("smtpPassword")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>No e-pasts (From email)</Label>
              <Input value={form.smtpFromEmail} onChange={(e) => setField("smtpFromEmail", e.target.value)} placeholder="noreply@uznemums.lv" />
            </div>
            <div className="space-y-1">
              <Label>No vārds (From name)</Label>
              <Input value={form.smtpFromName} onChange={(e) => setField("smtpFromName", e.target.value)} placeholder="Project Command Center" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Supabase Authentication → SMTP Settings: izmantojiet šo sadaļu, lai ieliktu savus SMTP datus.
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || loading}>
        {saving ? "Saglabā..." : "Saglabāt iestatījumus"}
      </Button>
    </div>
  )
}
