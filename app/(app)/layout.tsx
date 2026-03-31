import { AppNav } from "@/components/app-nav"
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

  return (
    <div className="flex min-h-screen">
      <AppNav />
      <main className="flex-1 p-6 bg-background overflow-auto">
        {children}
      </main>
    </div>
  )
}
