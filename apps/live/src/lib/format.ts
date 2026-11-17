/** `$1.2K`, `$3.4M`; null when unknown. */
export function usd(value: number | null | undefined, compact = true): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (!compact) return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: value >= 1000 ? 1 : 2 }).format(value);
}

/** A token price, with enough significant digits for a fraction of a cent. */
export function price(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
  return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 4 })}`;
}

export function percent(value: number | null | undefined, digits = 1): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `${value.toFixed(digits)}%`;
}

export function count(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-US', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

/** Raw base units to a decimal string, exact, with thousands grouped. */
export function units(raw: string | bigint, decimals: number, maxFraction = 6): string {
  const value = typeof raw === 'bigint' ? raw : /^\d+$/.test(raw) ? BigInt(raw) : 0n;
  const scale = 10n ** BigInt(decimals);
  const whole = (value / scale).toLocaleString('en-US');
  if (decimals === 0) return whole;
  const fraction = (value % scale).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const sol = (lamports: string | bigint): string => units(lamports, 9, 6);

/** `7xKX…Ab3d` */
export function short(address: string, keep = 4): string {
  return address.length <= keep * 2 + 1 ? address : `${address.slice(0, keep)}…${address.slice(-keep)}`;
}

export function ago(at: number | null | undefined, now: number = Date.now()): string | null {
  if (at === null || at === undefined || !Number.isFinite(at)) return null;
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export function duration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86_400).toFixed(1)} days`;
}

/** Base58, 32 to 44 characters: the shape of a Solana address. */
export const isAddress = (text: string): boolean => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text.trim());
/** Base58, 64 to 90 characters: the shape of a transaction signature. */
export const isSignature = (text: string): boolean => /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(text.trim());

export const solscan = {
  token: (mint: string) => `https://solscan.io/token/${mint}`,
  account: (address: string) => `https://solscan.io/account/${address}`,
  tx: (signature: string) => `https://solscan.io/tx/${signature}`,
};
