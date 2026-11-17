import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import { IconTile } from '@/components/reui/icon-tile';

/** A section of a page: ReUI's Frame, with a titled header and one panel. `flush` lets a table reach the edges. */
export function Panel({ title, description, icon, action, children, className, flush = false }: { title: ReactNode; description?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <Frame className={className}>
      <FrameHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <IconTile variant="soft" size="sm" className="mt-0.5 text-brand">
              {icon}
            </IconTile>
          )}
          <div className="min-w-0">
            <FrameTitle className="text-base">{title}</FrameTitle>
            {description && <FrameDescription>{description}</FrameDescription>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </FrameHeader>
      <FramePanel className={cn(flush && 'p-0')}>{children}</FramePanel>
    </Frame>
  );
}

/** A single figure with its icon, in a Frame: for rows of headline numbers. */
export function Stat({ label, value, icon, note, valueClassName }: { label: string; value: ReactNode; icon: ReactNode; note?: ReactNode; valueClassName?: string }) {
  return (
    <Frame spacing="sm">
      <FramePanel className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={cn('text-2xl font-semibold tracking-tight tabular-nums', valueClassName)}>{value}</span>
          {note && <span className="text-xs text-muted-foreground">{note}</span>}
        </div>
        <IconTile variant="soft" size="sm" className="text-brand">
          {icon}
        </IconTile>
      </FramePanel>
    </Frame>
  );
}
