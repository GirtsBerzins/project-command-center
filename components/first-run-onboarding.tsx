"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const ONBOARDING_KEY = "command-center:onboarding-v1-complete"

export function FirstRunOnboarding({ showForOwner }: { showForOwner: boolean }) {
  const [dismissed, setDismissed] = useState(false)

  function closeAndPersist() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_KEY, "1")
    }
    setDismissed(true)
  }

  if (!showForOwner || typeof window === "undefined") return null

  const isDone = window.localStorage.getItem(ONBOARDING_KEY) === "1"
  const open = !dismissed && !isDone

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? closeAndPersist() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sākuma iestatīšana (1-2 min)</DialogTitle>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Pārbaudiet komandas piekļuves: uzaiciniet kolēģus un apstipriniet lomas.</li>
          <li>Izveidojiet pirmo projektu un pārslēdzieties uz to kreisajā izvēlnē.</li>
          <li>Izskrieniet smoke-testu: Dashboard, Projects, Team, Streams, Tasks, KPI.</li>
        </ol>
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          Ātrās saites: <Link href="/team" className="underline underline-offset-2">Komanda</Link> ·{" "}
          <Link href="/projects" className="underline underline-offset-2">Projekti</Link> ·{" "}
          <Link href="/dashboard" className="underline underline-offset-2">Dashboard</Link>
        </div>
        <DialogFooter>
          <Button onClick={closeAndPersist}>Sapratu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
