import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, showLabel = false, ...props }, ref) => {
    const percent = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div className={cn("relative", className)} {...props} ref={ref}>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        {showLabel && (
          <span className="mt-1 block text-right text-xs text-muted-foreground">
            {Math.round(percent)}%
          </span>
        )}
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
