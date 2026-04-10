"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface Risk {
  impact: "high" | "critical"
  status: string
}

export function RisksWidget({ risks }: { risks: Risk[] }) {
  const [expanded, setExpanded] = useState(false)

  const critical = risks.filter((r) => r.impact === "critical").length
  const high = risks.filter((r) => r.impact === "high").length

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Kritiskie riski
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nav kritisko risku</p>
        ) : (
          <>
            {critical > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Kritiska</span>
                <Badge variant="destructive">{critical}</Badge>
              </div>
            )}
            {high > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Augsta</span>
                <Badge variant="destructive">{high}</Badge>
              </div>
            )}

            {expanded && (
              <div className="pt-1 border-t mt-2">
                <Link
                  href="/reports"
                  className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Skatīt pilnu risku sarakstu →
                </Link>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {risks.length} augsta prioritāte kopā
              </p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <>Aizvērt <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Paplašināt <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
