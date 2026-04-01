"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const ONBOARDING_KEY = "command-center:onboarding-v1-complete"

export function FirstRunOnboarding({ showForOwner }: { showForOwner: boolean }) {
  const [dismissed, setDismissed] = useState(false)
  // Start as "done" so server and client first-render both produce null —
  // avoids React hydration mismatch. The real value is read in useEffect.
  const [isDone, setIsDone] = useState(true)

  useEffect(() => {
    setIsDone(window.localStorage.getItem(ONBOARDING_KEY) === "1")
  }, [])

  function closeAndPersist() {
    window.localStorage.setItem(ONBOARDING_KEY, "1")
    setDismissed(true)
  }

  if (!showForOwner) return null

  const open = !dismissed && !isDone

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? closeAndPersist() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Laipni lūdzam Command Center! (1–2 min iestatīšana)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Šeit ir trīs soļi, lai sāktu darbu:
        </p>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Uzaiciniet kolēģus</strong> — dodieties uz{" "}
            <Link href="/team" className="underline underline-offset-2 hover:text-foreground" onClick={closeAndPersist}>
              Komanda
            </Link>{" "}
            un nosūtiet uzaicinājumus.
          </li>
          <li>
            <strong className="text-foreground">Izveidojiet pirmo projektu</strong> — dodieties uz{" "}
            <Link href="/projects" className="underline underline-offset-2 hover:text-foreground" onClick={closeAndPersist}>
              Projekti
            </Link>
            , nospiediet <em>Jauns projekts</em> un noklikšķiniet uz tā nosaukuma, lai to aktivizētu.
          </li>
          <li>
            <strong className="text-foreground">Pievienojiet straumes un uzdevumus</strong> — straumes ir darba virzieni (piemēram, „Izstrāde", „Testēšana"), uzdevumi ir konkrēti darbi katrā straumē.
          </li>
        </ol>
        <DialogFooter>
          <Button onClick={closeAndPersist}>Sākt darbu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
