import React, { createContext, useContext } from 'react';
import { cn } from "@/lib/utils"

const ProgressContext = createContext<{ value: number }>({ value: 0 });

export function Progress({
  value,
  className,
  children,
  ...props
}: {
  value: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <ProgressContext.Provider value={{ value }}>
      <div className={cn("flex flex-col gap-1.5 w-full", className)} {...props}>
        <div className="flex justify-between items-center w-full">
          {children}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full transition-all duration-300 ease-in-out"
            style={{
              width: `${Math.min(Math.max(value, 0), 100)}%`,
              backgroundColor: value < 35 ? 'oklch(0.44 0.14 269.19)' : value < 65 ? 'oklch(0.79 0.12 104.1)' : 'oklch(0.56 0.24 15.98)'
            }}
          />
        </div>
      </div>
    </ProgressContext.Provider>
  );
}

export function ProgressLabel({
  className,
  children,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={cn("text-xs font-semibold text-slate-500 dark:text-slate-400", className)} {...props}>
      {children}
    </span>
  );
}

export function ProgressValue({
  className,
  ...props
}: {
  className?: string;
}) {
  const { value } = useContext(ProgressContext);
  return (
    <span className={cn("text-xs font-semibold text-slate-900 dark:text-slate-50", className)} {...props}>
      {value}%
    </span>
  );
}
