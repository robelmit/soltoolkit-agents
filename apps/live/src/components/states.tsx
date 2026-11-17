import { WarningCircleIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/** Nothing to show yet, said plainly, with what to do about it. */
export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">{icon}</div>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Failure({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/8 p-3 text-sm text-danger">
      <WarningCircleIcon weight="duotone" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** "Unknown" in muted text, for a figure that could not be read: never shown as zero. */
export const Unknown = () => <span className="text-muted-foreground">—</span>;

export function Figure({ value }: { value: string | null }) {
  return value === null ? <Unknown /> : <>{value}</>;
}
