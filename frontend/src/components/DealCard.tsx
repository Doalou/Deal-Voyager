import * as React from "react"
import type { MobilePlan } from "../types"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface DealCardProps {
  plan: MobilePlan
}

export function DealCard({ plan }: DealCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price)
  }

  const scoreLabel = plan.score
    ? `${plan.score.toFixed(2)} €/Go`
    : "N/A"

  const operatorColorMap: { [key: string]: string } = {
    "Sosh": "border-orange-500",
    "RED by SFR": "border-red-500",
    "B&You": "border-teal-400",
    "Free Mobile": "border-stone-400",
    "Prixtel": "border-purple-500",
    "La Poste Mobile": "border-yellow-400",
    "NRJ Mobile": "border-red-400",
    "Auchan Telecom": "border-red-500",
    "Cdiscount Mobile": "border-green-500",
    "YouPrice": "border-blue-500",
    "Syma Mobile": "border-sky-500",
    "Lebara": "border-blue-600",
    "Coriolis": "border-pink-500",
  };

  const borderColorClass = operatorColorMap[plan.operator] || "border-primary";

  return (
    <Card className={`flex flex-col bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-t-4 ${borderColorClass}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>{plan.planName}</CardTitle>
                <CardDescription>{plan.operator}</CardDescription>
            </div>
            {plan.network && <Badge variant="outline">{plan.network}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="flex justify-around items-baseline text-center my-4">
            <div className="flex flex-col">
                <span className="text-4xl font-bold">{plan.dataGb}</span>
                <span className="text-muted-foreground">Go</span>
            </div>
            <div className="flex flex-col">
                <span className="text-4xl font-bold">{formatPrice(plan.price)}</span>
                <span className="text-muted-foreground">/mois</span>
            </div>
        </div>
        <p className="text-sm text-center text-muted-foreground mt-4">
          Score: <span className="font-semibold">{scoreLabel}</span> (plus c'est bas, mieux c'est)
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <a href={plan.url ?? '#'} target="_blank" rel="noopener noreferrer">
            Voir l'offre
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
} 