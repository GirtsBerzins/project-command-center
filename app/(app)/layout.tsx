import { AppNav } from "@/components/app-nav"
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
    <div className="flex min-h-screen">
      <AppNav initialRole={(me?.role as "owner" | "manager" | "member" | "viewer" | undefined) ?? undefined} />
      <main className="flex-1 p-6 bg-background overflow-auto">
        <FirstRunOnboarding showForOwner={me?.role === "owner"} />
        {children}
      </main>
    </div>
  )
}
