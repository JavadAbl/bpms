import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("md-skeleton bg-muted rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
