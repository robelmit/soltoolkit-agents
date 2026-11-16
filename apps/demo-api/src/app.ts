/**
 * The demo API: a few read-only routes over the tools of `@soltoolkit/mcp`,
 * with a budget per client and a short cache in front of the RPC endpoint.
 *
 * It is a function from a web-standard `Request` to a `Response`, so it is
 * tested without a socket and runs behind any HTTP server.
 *
 * Every answer is JSON: `{ "data": … }` or `{ "error": { "code", "message" } }`.
 * Nothing here signs, sends or stores anything about a caller.
 */

import type { Launchpads } from '@soltoolkit/launchpad-sdk';
import { DEFAULT_TOOL_LIMITS, InvalidArguments, TOOLS, ToolFailure, checkArguments, createMcpServer, type LaunchSource, type Tool, type ToolContext, type ToolLimits } from '@soltoolkit/mcp';
import { RpcError, type Rpc } from '@soltoolkit/rpc';
import { RateLimiter, TtlCache } from './guards';

export interface AppOptions {
  readonly rpcUrl: string;
  readonly rpc: Rpc;
  readonly launchpads: Launchpads;
  readonly feed?: LaunchSource | null;
  /** Points a client gets a minute (default 30). A quote costs 1, a safety report 2, a holder map 10. */
  readonly ratePerMinute?: number;
  /** Tool calls running at once across all clients (default 4); past it the answer is 503. */
  readonly maxConcurrent?: number;
  readonly limits?: Partial<ToolLimits>;
  readonly now?: () => number;
}

export interface App {
  /** `client` is what the budget is counted by: the caller's address as the HTTP server saw it. */
  handle(request: Request, client: string): Promise<Response>;
}

interface Route {
  readonly method: 'GET' | 'POST';
  /** Path segments; a segment starting with `:` is an argument of that name. */
  readonly path: readonly string[];
  readonly tool: string;
  readonly summary: string;
  /** Query parameters passed to the tool, and whether each is a number. */
  readonly query?: Readonly<Record<string, 'string' | 'number'>>;
  readonly cost: number;
  /** How long an answer is reused, in milliseconds; 0 for never. */
  readonly ttlMs: number;
  readonly body?: boolean;
}

export const ROUTES: readonly Route[] = [
  { method: 'GET', path: ['v1', 'quote'], tool: 'launchpad_quote', summary: 'Quote a buy or sell on pump.fun, PumpSwap or Meteora DBC', query: { mint: 'string', side: 'string', amountIn: 'string', slippageBps: 'number', wallet: 'string' }, cost: 1, ttlMs: 2_000 },
  { method: 'GET', path: ['v1', 'tokens', ':mint', 'safety'], tool: 'token_safety', summary: 'A graded safety report for a token', query: { creator: 'string' }, cost: 2, ttlMs: 60_000 },
  { method: 'GET', path: ['v1', 'tokens', ':mint', 'holders'], tool: 'holder_map', summary: 'The largest holders, the transfers among them and their clusters', query: { walk: 'number' }, cost: 10, ttlMs: 300_000 },
  { method: 'GET', path: ['v1', 'transactions', ':signature', 'app'], tool: 'identify_trading_app', summary: 'Which trading app placed a transaction', cost: 1, ttlMs: 600_000 },
  { method: 'GET', path: ['v1', 'apps'], tool: 'list_trading_apps', summary: 'The trading apps the registry can name', cost: 1, ttlMs: 3_600_000 },
  { method: 'GET', path: ['v1', 'launches'], tool: 'latest_launches', summary: 'The newest launchpad tokens (needs the launch feed)', query: { limit: 'number' }, cost: 1, ttlMs: 2_000 },
  { method: 'GET', path: ['v1', 'trending'], tool: 'trending_tokens', summary: 'The most traded launchpad tokens of the last five minutes (needs the launch feed)', query: { limit: 'number' }, cost: 1, ttlMs: 2_000 },
  { method: 'POST', path: ['v1', 'wallets', 'performance'], tool: 'wallet_performance', summary: 'Score a wallet from a list of trades in the body', cost: 2, ttlMs: 0, body: true },
];

/** Which HTTP status a tool's refusal becomes. Anything not listed is a 500 with a general message. */
const STATUS: Readonly<Record<string, number>> = { INVALID_ARGUMENTS: 400, NOT_A_TOKEN: 404, NOT_FOUND: 404, NO_VENUE: 404, NOT_ON_CURVE: 404, UNSUPPORTED: 422, UNREADABLE: 502, HOLDERS_UNAVAILABLE: 502, RPC_ERROR: 502, NO_FEED: 404 };
const MAX_BODY_BYTES = 1_048_576;
const MCP_COST = 2;

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' } as const;
const toJson = (value: unknown): string => JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));

function answer(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(toJson(body), { status, headers: { ...HEADERS, 'Cache-Control': 'no-store', ...headers } });
}

const refuse = (status: number, code: string, message: string, extra: { details?: unknown; headers?: Record<string, string> } = {}): Response =>
  answer(status, { error: { code, message, ...(extra.details !== undefined ? { details: extra.details } : {}) } }, extra.headers);

function match(route: Route, method: string, segments: readonly string[]): Record<string, string> | null {
  if (route.method !== method || route.path.length !== segments.length) return null;
  const args: Record<string, string> = {};
  for (let i = 0; i < segments.length; i += 1) {
    const want = route.path[i]!;
    if (want.startsWith(':')) args[want.slice(1)] = segments[i]!;
    else if (want !== segments[i]) return null;
  }
  return args;
}

export function createApp(options: AppOptions): App {
  const now = options.now ?? Date.now;
  const feed = options.feed ?? null;
  const context: ToolContext = { rpc: options.rpc, launchpads: options.launchpads, feed, limits: { ...DEFAULT_TOOL_LIMITS, ...options.limits } };
  const tools = new Map<string, Tool>(TOOLS.map((tool) => [tool.name, tool]));
  const routes = ROUTES.filter((route) => feed !== null || !tools.get(route.tool)?.needsFeed);
  const limiter = new RateLimiter(Math.max(1, options.ratePerMinute ?? 30), undefined, now);
  const cache = new TtlCache(5_000, now);
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 4);
  const mcp = createMcpServer({ rpcUrl: options.rpcUrl, rpc: options.rpc, launchpads: options.launchpads, feed, limits: options.limits, maxConcurrentCalls: maxConcurrent });
  let running = 0;

  const index = {
    name: 'soltoolkit demo API',
    about: 'Read-only. Every answer is {"data": …} or {"error": {"code", "message"}}. Unknown values are null, never zero. Token amounts are whole numbers of base units as strings.',
    limits: { pointsPerMinute: options.ratePerMinute ?? 30, note: 'Each route costs points; past the budget the answer is 429 with Retry-After.' },
    routes: [...routes.map((r) => ({ method: r.method, path: `/${r.path.join('/')}`, query: r.query ? Object.keys(r.query) : [], cost: r.cost, summary: r.summary })), { method: 'POST', path: '/mcp', query: [], cost: MCP_COST, summary: 'The same tools over the Model Context Protocol (JSON-RPC)' }],
  };

  async function run(route: Route, raw: Record<string, unknown>): Promise<Response> {
    const tool = tools.get(route.tool)!;
    let args: Record<string, unknown>;
    try {
      args = checkArguments(tool.input, raw);
    } catch (error) {
      if (error instanceof InvalidArguments) return refuse(400, 'INVALID_ARGUMENTS', error.message);
      throw error;
    }
    const read = async (): Promise<unknown> => {
      if (running >= maxConcurrent) throw new ToolFailure('BUSY', 'The server is busy. Try again in a moment.');
      running += 1;
      try {
        return await tool.run(args, context);
      } finally {
        running -= 1;
      }
    };
    try {
      const key = `${route.tool}:${JSON.stringify(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)))}`;
      const data = route.ttlMs > 0 ? await cache.get(key, route.ttlMs, read) : await read();
      return answer(200, { data });
    } catch (error) {
      if (error instanceof ToolFailure) {
        if (error.code === 'BUSY') return refuse(503, 'BUSY', error.message, { headers: { 'Retry-After': '2' } });
        return refuse(STATUS[error.code] ?? 500, error.code, error.message, { details: error.details });
      }
      if (error instanceof RpcError) return refuse(502, 'RPC_ERROR', 'The Solana RPC endpoint answered with an error.');
      // What went wrong inside stays inside: a caller gets a general sentence, never a stack or an endpoint's address.
      return refuse(500, 'FAILED', 'The request could not be answered.');
    }
  }

  async function handle(request: Request, client: string): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    if (segments.length === 0 && method === 'GET') return answer(200, { data: index }, { 'Cache-Control': 'public, max-age=300' });
    if (segments.length === 1 && segments[0] === 'health' && method === 'GET') return answer(200, { data: { ok: true, feed: feed !== null } });

    if (segments.length === 1 && segments[0] === 'mcp') {
      const response = await mcp.handleHttp(request, { limit: () => limiter.take(client, MCP_COST) });
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, headers });
    }

    for (const route of routes) {
      const fromPath = match(route, method, segments);
      if (!fromPath) continue;
      const retryAfter = limiter.take(client, route.cost);
      if (retryAfter !== null) return refuse(429, 'RATE_LIMITED', 'Too many requests. This is a free demo endpoint; run your own for more.', { headers: { 'Retry-After': String(retryAfter) } });
      const raw: Record<string, unknown> = { ...fromPath };
      for (const [name, kind] of Object.entries(route.query ?? {})) {
        const value = url.searchParams.get(name);
        if (value === null || value === '') continue;
        raw[name] = kind === 'number' ? (/^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value) : value;
      }
      if (route.body) {
        if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) return refuse(413, 'TOO_LARGE', 'The body is too large.');
        let body: unknown;
        try {
          const text = await request.text();
          if (text.length > MAX_BODY_BYTES) return refuse(413, 'TOO_LARGE', 'The body is too large.');
          body = JSON.parse(text);
        } catch {
          return refuse(400, 'INVALID_ARGUMENTS', 'The body is not JSON.');
        }
        if (typeof body !== 'object' || body === null || Array.isArray(body)) return refuse(400, 'INVALID_ARGUMENTS', 'The body must be a JSON object.');
        Object.assign(raw, body);
      }
      return run(route, raw);
    }

    if (ROUTES.some((route) => route.path.length === segments.length && match({ ...route, method: route.method === 'GET' ? 'POST' : 'GET' }, method, segments))) return refuse(405, 'METHOD_NOT_ALLOWED', 'That route does not take this method.');
    return refuse(404, 'NO_ROUTE', 'No such route. GET / lists them.');
  }

  return { handle };
}
