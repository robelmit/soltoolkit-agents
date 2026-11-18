import { cn } from 'cn';
import type { HTMLAttributes, ReactNode } from 'react';

/** A card: #141416, 1px border, 20px radius, a solid 2px bottom edge. The soltoolkit pay look. */
export function Surface({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('relative overflow-hidden rounded-[20px] border border-border bg-card text-card-foreground shadow-[0_2px_0_var(--border-shadow)]', className)} {...props} />;
}

/** A green icon on a round tinted disc. */
export function IconDisc({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-primary-light text-primary [&_svg]:size-[18px]', className)}>{children}</span>;
}

/** A section of a page: a titled card with one body. `flush` lets a table reach the edges. */
export function Panel({ title, description, icon, action, children, className, flush = false }: { title: ReactNode; description?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <Surface className={className}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <IconDisc>{icon}</IconDisc>}
          <div className="min-w-0">
            <h2 className="text-[15px] leading-tight font-bold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn(flush ? 'p-0' : 'p-4')}>{children}</div>
    </Surface>
  );
}

/** A single figure with its icon: for rows of headline numbers. */
export function Stat({ label, value, icon, note, valueClassName }: { label: string; value: ReactNode; icon: ReactNode; note?: ReactNode; valueClassName?: string }) {
  return (
    <Surface className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-muted-foreground">{label}</span>
        <IconDisc className="size-8">{icon}</IconDisc>
      </div>
      <span className={cn('text-[26px] leading-none font-extrabold tracking-[-0.04em] tabular-nums', valueClassName)}>{value}</span>
      {note && <span className="text-[12px] text-muted-foreground">{note}</span>}
    </Surface>
  );
}
