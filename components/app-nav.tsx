"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Layers, CheckSquare, Zap, BarChart2, FileText, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/dashboard", label: "Vadības panelis", icon: LayoutDashboard },
  { href: "/streams",   label: "Straumes",        icon: Layers },
  { href: "/tasks",     label: "Uzdevumi",         icon: CheckSquare },
  { href: "/sprints",   label: "Sprinti",          icon: Zap },
  { href: "/kpis",      label: "KPI",              icon: BarChart2 },
  { href: "/reports",   label: "Atskaites",        icon: FileText },
]

export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-56 shrink-0 border-r bg-sidebar-background min-h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="font-bold text-sm tracking-tight text-sidebar-foreground">
          Command Center
        </h1>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Iziet
        </Button>
      </div>
    </aside>
  )
}
