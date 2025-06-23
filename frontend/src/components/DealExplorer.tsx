import * as React from "react"
import { useState, useMemo } from "react"
import type { MobilePlan } from "../types"
import { DealCard } from "./DealCard"
import { Button } from "@/components/ui/button"

interface DealExplorerProps {
  initialDeals: MobilePlan[]
}

type SortKey = "score" | "price" | "dataGb"

export function DealExplorer({ initialDeals }: DealExplorerProps) {
  const [deals, setDeals] = useState<MobilePlan[]>(initialDeals)
  const [sortKey, setSortKey] = useState<SortKey>("score")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const valA = a[sortKey] ?? 0
      const valB = b[sortKey] ?? 0

      if (valA < valB) return sortOrder === "asc" ? -1 : 1
      if (valA > valB) return sortOrder === "asc" ? 1 : -1
      return 0
    })
  }, [deals, sortKey, sortOrder])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      // Si on clique sur le même tri, on inverse l'ordre
      setSortOrder(current => (current === "asc" ? "desc" : "asc"))
    } else {
      // Nouveau tri
      setSortKey(key)
      // Par défaut, le score est ascendant, les autres descendants
      setSortOrder(key === "score" || key === "price" ? "asc" : "desc")
    }
  }

  const getButtonVariant = (key: SortKey) => {
    return sortKey === key ? "default" : "secondary"
  }

  return (
    <div>
      <div className="flex justify-center gap-4 mb-8 p-4 bg-card/50 border rounded-lg backdrop-blur-sm ring-1 ring-white/10">
        <span className="self-center text-muted-foreground">Trier par :</span>
        <Button variant={getButtonVariant("score")} onClick={() => handleSort("score")}>
          Score (€/Go) {sortKey === 'score' && (sortOrder === 'asc' ? '▲' : '▼')}
        </Button>
        <Button variant={getButtonVariant("price")} onClick={() => handleSort("price")}>
          Prix {sortKey === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}
        </Button>
        <Button variant={getButtonVariant("dataGb")} onClick={() => handleSort("dataGb")}>
          Data {sortKey === 'dataGb' && (sortOrder === 'asc' ? '▲' : '▼')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {sortedDeals.map(deal => (
          <DealCard key={deal.id} plan={deal} />
        ))}
      </div>
    </div>
  )
} 