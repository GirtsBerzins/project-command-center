import { AppShell } from "@/components/app-shell"
import { FirstRunOnboarding } from "@/components/first-run-onboarding"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return (
    <AppShell initialRole={(me?.role as "owner" | "manager" | "member" | "viewer" | undefined) ?? undefined}>
      <FirstRunOnboarding showForOwner={me?.role === "owner"} />
      {children}
    </AppShell>
  )
}
