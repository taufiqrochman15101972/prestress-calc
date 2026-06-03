import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  unit?: string;
  error?: string;
}

export function Input({ className, label, unit, error, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-gray-600">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          id={id}
          className={cn(
            "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:opacity-50",
            unit && "pr-12",
            error && "border-red-400",
            className
          )}
          {...props}
        />
        {unit && (
          <span className="absolute right-3 text-xs text-gray-400 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
