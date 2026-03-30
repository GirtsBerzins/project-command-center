import { AppNav } from "@/components/app-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppNav />
      <main className="flex-1 p-6 bg-background overflow-auto">
        {children}
      </main>
    </div>
  )
}
