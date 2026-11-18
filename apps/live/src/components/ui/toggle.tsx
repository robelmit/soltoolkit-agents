import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Toggle as TogglePrimitive } from "radix-ui"

const toggleVariants = cva(
  // A pill tab: muted text, and the chosen one raised on a card-coloured pill with a hairline edge.
  "group/toggle inline-flex items-center justify-center gap-1.5 rounded-full text-[13.5px] font-medium tracking-[-0.01em] whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] duration-200 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_0_var(--border-shadow),inset_0_0_0_0.5px_var(--border)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "bg-transparent",
      },
      size: {
        default:
          "h-8 min-w-8 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        sm: "h-7 min-w-7 px-3 text-[12.5px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
