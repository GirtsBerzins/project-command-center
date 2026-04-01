"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [oauthLoading, setOauthLoading] = useState<"github" | "google" | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const callbackError =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("error") : null

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        : await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
            },
          })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setLoading(false)
      if (mode === "signup") {
        if (data?.session) {
          router.push("/dashboard")
          router.refresh()
        } else {
          setError("Reģistrācija pabeigta. Pārbaudiet e-pastu, lai apstiprinātu kontu.")
        }
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    }
  }

  async function handleOAuth(provider: "github" | "google") {
    setError(null)
    setOauthLoading(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })
    if (error) {
      setError(error.message)
      setOauthLoading(null)
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setError("Ievadiet e-pastu, lai nosūtītu paroles atjaunošanu.")
      return
    }
    setError(null)
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/login`,
    })
    setResetLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setError("Paroles atjaunošanas e-pasts nosūtīts.")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Projektu komandcentrs</CardTitle>
          <CardDescription>
            {mode === "login" ? "Pierakstieties, lai turpinātu" : "Izveidojiet kontu, lai sāktu darbu"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => setMode("login")}
            >
              Ielogoties
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "outline"}
              onClick={() => setMode("signup")}
            >
              Reģistrēties
            </Button>
          </div>

          <div className="space-y-2 mb-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("github")}
              disabled={!!oauthLoading}
            >
              {oauthLoading === "github" ? "Pāradresē..." : "Turpināt ar GitHub"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("google")}
              disabled={!!oauthLoading}
            >
              {oauthLoading === "google" ? "Pāradresē..." : "Turpināt ar Google"}
            </Button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">vai ar e-pastu</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-pasts</Label>
              <Input
                id="email"
                type="email"
                placeholder="jusu@epasts.lv"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parole</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {mode === "login" && (
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={handleResetPassword}
                disabled={resetLoading}
              >
                {resetLoading ? "Sūta..." : "Aizmirsu paroli"}
              </Button>
            )}
            {callbackError && (
              <p className="text-sm text-destructive">
                Autorizācija neizdevās. Lūdzu mēģiniet vēlreiz.
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Apstrādā..." : mode === "login" ? "Pierakstīties" : "Izveidot kontu"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
