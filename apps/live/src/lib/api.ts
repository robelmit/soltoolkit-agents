/**
 * The demo API, as the site sees it. Every route answers `{ data }` or `{ error: { code, message } }`; the shapes
 * below are the tools' outputs from `@soltoolkit/mcp`. Unknown figures are `null`, never zero.
 */

export const API_BASE = ((import.meta.env['VITE_API_URL'] as string | undefined) ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'The API did not answer. Check your connection and try again.');
  }
  const body = (await response.json().catch(() => null)) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (!response.ok || !body || body.data === undefined) {
    const retry = Number(response.headers.get('retry-after'));
    throw new ApiError(response.status, body?.error?.code ?? 'FAILED', body?.error?.message ?? `The API answered ${response.status}.`, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return body.data;
}

/** What to tell a person about a failed call. */
export function explain(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong.';
  if (error.code === 'RATE_LIMITED') return `The free API allows a few calls a minute. Try again in ${error.retryAfter ?? 'a few'} seconds.`;
  if (error.code === 'BUSY') return 'The API is busy right now. Try again in a moment.';
  return error.message;
}

export type Stage = 'new' | 'bonding' | 'migrated';

export interface LaunchToken {
  readonly address: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimals?: number | null;
  readonly launchpad?: string | null;
  readonly stage?: Stage | null;
  /** Bonding curve progress in percent. */
  readonly curve?: number | null;
  readonly price?: number | null;
  readonly mc?: number | null;
  readonly liqUsd?: number | null;
  readonly holders?: number | null;
  readonly createdAt?: number | null;
  readonly creator?: string | null;
  readonly audit?: { readonly mintRevoked?: boolean | null; readonly freezeRevoked?: boolean | null } | null;
  readonly m5?: { readonly trades: number; readonly buys: number; readonly volumeUsd: number | null; readonly priceChangePct: number | null };
  readonly lastTradeAt?: number | null;
}

export type SafetyGrade = 'safe' | 'caution' | 'risky' | 'dangerous' | 'unknown';

export interface SafetyCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly label: string;
  readonly detail: string;
  readonly critical: boolean;
  readonly unverified: boolean;
}

export interface Safety {
  readonly mint: string;
  readonly report: { readonly score: number; readonly maxScore: number; readonly checks: readonly SafetyCheck[]; readonly grade: SafetyGrade; readonly cappedBy?: string; readonly unverifiedCount: number; readonly incomplete: boolean };
  readonly warnings: readonly string[];
  readonly notes: readonly string[];
  readonly facts: {
    readonly mint: string;
    readonly tokenProgram: 'spl-token' | 'spl-token-2022';
    readonly decimals: number;
    /** Raw units, as a string. */
    readonly supply: string;
    readonly mintAuthority: string | null;
    readonly freezeAuthority: string | null;
    readonly extensions: readonly { readonly name: string }[];
    readonly metadata?: { readonly name: string; readonly symbol: string; readonly uri: string; readonly updateAuthority: string | null; readonly mutable: boolean };
    readonly holders?: { readonly top10Pct: number; readonly complete: boolean };
  };
}

export interface HolderMapData {
  readonly mint: string;
  readonly nodes: { id: string; pct: number | null; type: string; label?: string; cluster?: number }[];
  readonly edges: { a: string; b: string; kind: 'transfer' | 'funding' | 'bundle' | 'sniper' | 'insider' }[];
  readonly clusters: { id: number; pct: number; wallets: number }[];
  readonly notes: readonly string[];
  readonly walked: number;
}

export interface Quote {
  readonly venue: string;
  readonly side: 'buy' | 'sell';
  readonly mint: string;
  readonly inAmount: string;
  readonly outAmount: string;
  readonly minOutAmount: string;
  readonly slippageBps: number;
  readonly venueFeeLamports: string;
  readonly priceImpactBps: number | null;
  readonly quotedAt: number;
}

export interface TradingApp {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly chains: readonly string[];
  readonly active: boolean;
}

export interface AppAttribution {
  readonly signature: string;
  readonly failed: boolean;
  readonly platform: string | null;
  readonly by: string | null;
  readonly evidence: unknown;
}

export interface WalletTrade {
  readonly ts: number;
  readonly token: string;
  readonly side: 'buy' | 'sell';
  readonly amount: number;
  readonly valueUsd: number;
}

export interface WalletReport {
  readonly trades: number;
  readonly smartScore: number;
  readonly performance: {
    readonly realizedPnlUsd: number;
    readonly totalVolumeUsd: number;
    readonly tradeCount: number;
    readonly winRate: number;
    readonly winCount: number;
    readonly lossCount: number;
    readonly avgHoldSeconds: number;
    readonly bestMultiple: number;
    readonly worstMultiple: number;
    readonly positions: readonly { readonly token: string; readonly amount: number; readonly realizedPnlUsd: number; readonly investedUsd: number; readonly holdSeconds: number | null }[];
  };
}

export interface Health {
  readonly ok: boolean;
  readonly feed?: unknown;
}

export async function health(): Promise<Health | null> {
  try {
    const response = await fetch(`${API_BASE}/health`, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    // The demo API wraps it like every other answer: { data: { ok, feed } }.
    const body = (await response.json()) as { data?: Health } & Partial<Health>;
    return body.data ?? (typeof body.ok === 'boolean' ? (body as Health) : null);
  } catch {
    return null;
  }
}
