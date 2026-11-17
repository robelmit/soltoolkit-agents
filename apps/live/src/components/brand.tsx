import { cn } from 'cn';

/** The soltoolkit mark: two parallel bars in Solana's purple-to-green, on a dark tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <defs>
        <linearGradient id="soltoolkit-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0b0b0f" />
      <path d="M9 11h14l-3 3H6zM12 18h14l-3 3H9z" fill="url(#soltoolkit-mark)" />
    </svg>
  );
}
