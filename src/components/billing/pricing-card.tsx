"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  name: string;
  description: string;
  price: number;
  features: string[];
  isCurrentPlan: boolean;
  onSelect: () => void;
  loading?: boolean;
  highlighted?: boolean;
}

export function PricingCard({
  name,
  description,
  price,
  features,
  isCurrentPlan,
  onSelect,
  loading,
  highlighted,
}: PricingCardProps) {
  return (
    <Card className={cn("relative", highlighted && "border-primary shadow-lg")}>
      {highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Popular</Badge>
      )}
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="pt-4">
          <span className="text-4xl font-bold">${price}</span>
          <span className="text-muted-foreground">/month</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={isCurrentPlan ? "secondary" : "default"}
          onClick={onSelect}
          disabled={isCurrentPlan || loading}
        >
          {isCurrentPlan ? "Current Plan" : loading ? "Loading..." : "Upgrade"}
        </Button>
      </CardFooter>
    </Card>
  );
}
