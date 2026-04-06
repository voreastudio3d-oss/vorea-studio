import * as React from "react"
import { cn } from "./button"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "beta" | "tier"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-[#C6E36C] text-black",
    secondary: "border-transparent bg-[#1a1f36] text-white",
    destructive: "border-transparent bg-red-500 text-white",
    outline: "text-foreground",
    beta: "border-transparent bg-orange-500/20 text-orange-400 border border-orange-500/30",
    tier: "border-transparent bg-blue-500/20 text-blue-400 border border-blue-500/30",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }