import { WarningCircleIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/reui/alert';
import { Empty as EmptyRoot, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** Nothing to show yet, said plainly, with what to do about it. */
export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <EmptyRoot className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </EmptyRoot>
  );
}

/** A failed read, as ReUI's Alert. */
export function Failure({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <WarningCircleIcon weight="duotone" />
      <AlertDescription className="text-foreground">{message}</AlertDescription>
    </Alert>
  );
}

/** "Unknown" in muted text, for a figure that could not be read: never shown as zero. */
export const Unknown = () => <span className="text-muted-foreground">—</span>;

export function Figure({ value }: { value: string | null }) {
  return value === null ? <Unknown /> : <>{value}</>;
}
