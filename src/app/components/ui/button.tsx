import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const buttonVariantClasses = {
  default:
    "bg-primary text-primary-foreground " +
    "hover:bg-primary/90 hover:shadow-[0_0_18px_rgba(198,227,108,0.25)] " +
    "active:scale-[0.97] cursor-pointer",
  secondary:
    "border border-primary text-primary bg-transparent " +
    "hover:bg-primary/10 hover:border-primary/70 " +
    "active:scale-[0.97] cursor-pointer",
  outline:
    "border border-border bg-transparent text-foreground " +
    "hover:bg-white/5 hover:border-border " +
    "active:scale-[0.97] cursor-pointer",
  ghost:
    "hover:bg-accent hover:text-accent-foreground " +
    "active:scale-[0.97] cursor-pointer",
  link:
    "text-primary underline-offset-4 hover:underline cursor-pointer",
  destructive:
    "bg-red-500/10 text-red-400 border border-red-500/30 " +
    "hover:bg-red-500/20 hover:border-red-500/50 " +
    "active:scale-[0.97] cursor-pointer",
} as const;

const buttonSizeClasses = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
} as const;

type ButtonVariant = keyof typeof buttonVariantClasses;
type ButtonSize = keyof typeof buttonSizeClasses;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
}

export function buttonVariants({
  className,
  size = "default",
  variant = "default",
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
} = {}) {
  return cn(
    // Base
    "inline-flex items-center justify-center rounded-[10px] text-sm font-medium",
    // Focus
    "ring-offset-background transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    // Disabled
    "disabled:pointer-events-none disabled:opacity-40",
    // Cursor always pointer (overridden by disabled above)
    "cursor-pointer",
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    className,
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Filter out design-inspector internal props (e.g. _fgT, _fgS, _fgB)
    // that would otherwise leak to DOM elements via asChild/Slot
    const filteredProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !key.startsWith('_fg'))
    ) as React.ButtonHTMLAttributes<HTMLButtonElement>

    return (
      <Comp
        className={buttonVariants({ className, variant, size })}
        ref={ref}
        {...filteredProps}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
