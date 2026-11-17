import { cn } from 'cn';

/** The soltoolkit mark: two parallel bars in solid Solana purple on a dark tile. No gradient. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#0b0b0f" />
      <path d="M9 11h14l-3 3H6zM12 18h14l-3 3H9z" fill="#9945FF" />
    </svg>
  );
}
