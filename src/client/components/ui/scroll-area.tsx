import * as React from "react"
import { cn } from "@/lib/utils"

export function ScrollArea({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-auto pr-1.5 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800", className)}
      {...props}
    >
      <div className="h-full w-full rounded-[inherit]">
        {children}
      </div>
    </div>
  )
}
