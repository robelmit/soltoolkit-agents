import { cn } from 'cn';

/** The soltoolkit mark: two parallel bars in solid green on a dark tile, as on soltoolkit pay. No gradient. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="9" fill="#141416" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#2a2a2d" />
      <path d="M9 11h14l-3 3H6zM12 18h14l-3 3H9z" fill="#6cc864" />
    </svg>
  );
}
