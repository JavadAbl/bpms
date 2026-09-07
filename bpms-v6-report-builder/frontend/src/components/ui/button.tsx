'use client';

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useRipple } from "@/components/ui/ripple"

/**
 * MD3 button (UI redesign Phase 1):
 * - full pill shape
 * - filled / tonal / outlined / text / error variants
 * - state layers (hover 8%, press 12%) + ripple micro-interaction
 * API (variant/size names, asChild) unchanged from shadcn — drop-in.
 */
const buttonVariants = cva(
  "md-ripple-host state-layer state-layer-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:shadow-elev-1 active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground hover:shadow-elev-1 active:shadow-none focus-visible:ring-destructive/30",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:shadow-elev-1 active:shadow-none",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-11 px-7 has-[>svg]:px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  onPointerDown,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const { addRipple, rippleElement } = useRipple()
  const Comp = asChild ? Slot : "button"

  if (asChild) {
    // Slot children own their DOM — no ripple injection (still fully styled)
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      onPointerDown={(e) => {
        addRipple(e)
        onPointerDown?.(e)
      }}
      {...props}
    >
      {children}
      {rippleElement}
    </Comp>
  )
}

export { Button, buttonVariants }
