import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "danger" | "warning" | "info";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        {
          "bg-gray-100 text-gray-700": variant === "default",
          "bg-green-100 text-green-800": variant === "success",
          "bg-red-100 text-red-800": variant === "danger",
          "bg-yellow-100 text-yellow-800": variant === "warning",
          "bg-blue-100 text-blue-800": variant === "info",
        },
        className
      )}
      {...props}
    />
  );
}
