import * as React from "react"
import { cn } from "@/lib/utils"
import {Label} from "@radix-ui/react-label";

const Input = React.forwardRef<HTMLInputElement>(
  ({ default: defaultValue, name, title, className, type, ...props }, ref) => {
    return (
        <div>
            <Label htmlFor={name}>{title}</Label>
            <input
                type={"text"}
                name={name}
                className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                    className
                )}
                ref={ref}
                defaultValue={defaultValue}
                {...props}
            />
        </div>

    )
  }
)
Input.displayName = "Input"

export {Input}
