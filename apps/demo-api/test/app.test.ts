import type { Launchpads } from '@soltoolkit/launchpad-sdk';
import type { Rpc } from '@soltoolkit/rpc';
import { describe, expect, it } from 'vitest';
import { ROUTES, createApp } from '../src/app';
import { RateLimiter, TtlCache } from '../src/guards';

const MINT = 'FWFxnxR1Esvv6Ebcntr357ri1mucV5FiKTG1kEiBpump';
const SIGNATURE = '4YSbm9KCpDV2orrQPeXg41hw9tzdSfNLe3ehJzqkPNxoTgepXwKWZhcjSbtkwFqzNKKCxNNnpL9XFKsDQt3u3gVc';

function harness(options: { rpc?: (method: string) => unknown; feed?: boolean; ratePerMinute?: number; maxConcurrent?: number } = {}) {
  let now = 1_000_000;
  const calls: string[] = [];
  let quotes = 0;
  const rpc: Rpc = {
    async call<T>(method: string): Promise<T> {
      calls.push(method);
      return (options.rpc ? await options.rpc(method) : null) as T;
    },
  };
  const launchpads = {
    quote: async (request: { side: 'buy' | 'sell'; mint: string; amountIn: bigint; slippageBps: number }) => {
      quotes += 1;
      return { venue: 'pumpfun', side: request.side, mint: request.mint, inAmount: request.amountIn, outAmount: 123456789012345678901n, minOutAmount: 1n, slippageBps: request.slippageBps, venueFeeLamports: 5n, priceImpactBps: null, state: {}, quotedAt: now };
    },
  } as unknown as Launchpads;
  const feed = options.feed ? { latest: async () => [{ address: MINT, price: null }], trending: async () => [] } : null;
  const app = createApp({ rpcUrl: 'http://rpc.invalid', rpc, launchpads, feed, ratePerMinute: options.ratePerMinute, maxConcurrent: options.maxConcurrent, now: () => now });
  const get = (path: string, client = 'a'): Promise<Response> => app.handle(new Request(`http://api.test${path}`), client);
  const post = (path: string, body: unknown, client = 'a'): Promise<Response> => app.handle(new Request(`http://api.test${path}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' } }), client);
  const json = async (response: Response): Promise<{ data?: Record<string, unknown>; error?: { code: string; message: string; details?: unknown } }> => (await response.json()) as never;
  return { app, get, post, json, calls, quotes: () => quotes, tick: (ms: number) => (now += ms) };
}

describe('routes', () => {
  it('lists itself, and leaves the feed routes out when there is no feed', async () => {
    const h = harness();
    const index = await h.json(await h.get('/'));
    const paths = (index.data!['routes'] as { path: string }[]).map((r) => r.path);
    expect(paths).toContain('/v1/quote');
    expect(paths).toContain('/mcp');
    expect(paths).not.toContain('/v1/launches');
    expect((await h.get('/v1/launches')).status).toBe(404);
    expect(await h.json(await h.get('/health'))).toEqual({ data: { ok: true, feed: false } });
    const withFeed = harness({ feed: true });
    expect(await withFeed.json(await withFeed.get('/v1/launches?limit=5'))).toEqual({ data: { tokens: [{ address: MINT, price: null }] } });
  });

  it('quotes with amounts as strings and reuses the answer for a moment', async () => {
    const h = harness();
    const first = await h.get(`/v1/quote?mint=${MINT}&side=buy&amountIn=10000000&slippageBps=100`);
    expect(first.status).toBe(200);
    expect(first.headers.get('access-control-allow-origin')).toBe('*');
    expect((await h.json(first)).data).toMatchObject({ venue: 'pumpfun', inAmount: '10000000', outAmount: '123456789012345678901', slippageBps: 100, priceImpactBps: null });
    await h.get(`/v1/quote?mint=${MINT}&side=buy&amountIn=10000000&slippageBps=100`);
    expect(h.quotes()).toBe(1);
    h.tick(2_001);
    await h.get(`/v1/quote?mint=${MINT}&side=buy&amountIn=10000000&slippageBps=100`);
    expect(h.quotes()).toBe(2);
  });

  it('refuses bad input with 400 and says what was wrong', async () => {
    const h = harness();
    const missing = await h.get('/v1/quote?side=buy&amountIn=1');
    expect(missing.status).toBe(400);
    expect((await h.json(missing)).error).toMatchObject({ code: 'INVALID_ARGUMENTS', message: expect.stringContaining('"mint" is required') });
    expect((await h.get(`/v1/quote?mint=${MINT}&side=buy&amountIn=1&slippageBps=abc`)).status).toBe(400);
    expect((await h.get('/v1/tokens/not-a-mint/safety')).status).toBe(400);
    expect(h.quotes()).toBe(0);
    expect(h.calls).toEqual([]);
  });

  it('maps a tool\'s refusal to a status and never leaks what went wrong inside', async () => {
    const missing = harness({ rpc: () => null });
    const notFound = await missing.get(`/v1/transactions/${SIGNATURE}/app`);
    expect(notFound.status).toBe(404);
    expect((await missing.json(notFound)).error!.code).toBe('NOT_FOUND');

    const broken = harness({ rpc: () => { throw new Error('connect ECONNREFUSED 10.0.0.5:8899 key=abc'); } });
    const failed = await broken.get(`/v1/transactions/${SIGNATURE}/app`);
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|key=/);
    // A failed read is not kept: the next call asks again.
    await broken.get(`/v1/transactions/${SIGNATURE}/app`);
    expect(broken.calls).toHaveLength(2);
  });

  it('scores a wallet from the body and refuses a body it cannot read', async () => {
    const h = harness();
    const ok = await h.post('/v1/wallets/performance', { trades: [{ ts: 1, token: 'A', side: 'buy', amount: 1, valueUsd: 10 }, { ts: 2, token: 'A', side: 'sell', amount: 1, valueUsd: 25 }] });
    expect(ok.status).toBe(200);
    expect(((await h.json(ok)).data!['performance'] as { realizedPnlUsd: number }).realizedPnlUsd).toBe(15);
    expect((await h.post('/v1/wallets/performance', '{broken')).status).toBe(400);
    expect((await h.post('/v1/wallets/performance', [1])).status).toBe(400);
    expect((await h.post('/v1/wallets/performance', { trades: 'x' })).status).toBe(400);
  });

  it('answers 405 for the wrong method, 404 for no route, and CORS preflight', async () => {
    const h = harness();
    expect((await h.post('/v1/apps', {})).status).toBe(405);
    expect((await h.get('/v1/wallets/performance')).status).toBe(405);
    expect((await h.get('/v2/anything')).status).toBe(404);
    const preflight = await h.app.handle(new Request('http://api.test/v1/apps', { method: 'OPTIONS' }), 'a');
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('serves the MCP endpoint with the same tools and counts it against the budget', async () => {
    const h = harness({ ratePerMinute: 4 });
    const listed = await h.post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as { result: { tools: unknown[] } }).result.tools).toHaveLength(6);
    expect((await h.post('/mcp', { jsonrpc: '2.0', id: 2, method: 'ping' })).status).toBe(200);
    const limited = await h.post('/mcp', { jsonrpc: '2.0', id: 3, method: 'ping' });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('30');
  });

  it('has a tool behind every route', () => {
    for (const route of ROUTES) expect(route.cost).toBeGreaterThan(0);
    expect(new Set(ROUTES.map((r) => r.tool)).size).toBe(ROUTES.length);
  });
});

describe('the budget', () => {
  it('counts by client and by what a route costs, and says when to come back', async () => {
    const h = harness({ ratePerMinute: 12, rpc: () => null });
    // A holder map costs 10 of the 12 points; the next one waits for 8 more points at 12 a minute.
    expect((await h.get(`/v1/tokens/${MINT}/holders`)).status).not.toBe(429);
    const limited = await h.get(`/v1/tokens/${MINT}/holders`);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('40');
    expect((await h.json(limited)).error!.code).toBe('RATE_LIMITED');
    expect((await h.get('/v1/apps')).status).toBe(200);
    expect((await h.get('/v1/apps', 'someone-else')).status).toBe(200);
    // The call to /v1/apps took a point too, so the wait is a little longer than the header said.
    h.tick(45_000);
    expect((await h.get(`/v1/tokens/${MINT}/holders`)).status).not.toBe(429);
  });

  it('refills evenly, never past the burst, and forgets old clients when full', () => {
    let now = 0;
    const limiter = new RateLimiter(60, 2, () => now, 10);
    expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([null, null, 1]);
    now = 1_000;
    expect(limiter.take('a')).toBeNull();
    now = 600_000;
    expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([null, null, 1]);
    for (let i = 0; i < 30; i += 1) limiter.take(`c${i}`);
    expect(limiter.take('a')).toBeNull();
  });

  it('refuses work past what it runs at once', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const h = harness({ maxConcurrent: 1, rpc: async () => { await gate; return null; } });
    const first = h.get(`/v1/transactions/${SIGNATURE}/app`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const busy = await h.get(`/v1/transactions/${SIGNATURE.replace('4', '5')}/app`);
    expect(busy.status).toBe(503);
    expect(busy.headers.get('retry-after')).toBe('2');
    release();
    expect((await first).status).toBe(404);
  });
});

describe('the cache', () => {
  it('shares one read between callers, expires, and drops a read that failed', async () => {
    let now = 0;
    let reads = 0;
    const cache = new TtlCache(3, () => now);
    const read = async (): Promise<number> => ++reads;
    expect(await Promise.all([cache.get('k', 1_000, read), cache.get('k', 1_000, read)])).toEqual([1, 1]);
    now = 1_001;
    expect(await cache.get('k', 1_000, read)).toBe(2);
    await expect(cache.get('bad', 1_000, async () => { throw new Error('no'); })).rejects.toThrow('no');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await cache.get('bad', 1_000, async () => 7)).toBe(7);
    for (let i = 0; i < 10; i += 1) await cache.get(`k${i}`, 1_000, read);
    expect(cache.size).toBeLessThanOrEqual(3);
  });
});

describe('share page', () => {
  it('serves preview tags for a token and sends people on to its page, escaping what it prints', async () => {
    const h = harness();
    const response = await h.get(`/t/${MINT}`);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    // The faked chain answers nothing, so the page falls back to a general card.
    expect(html).toContain('<meta property="og:title" content="A Solana token, checked on soltoolkit Live">');
    expect(html).toContain('<meta property="og:image" content="http://api.test/og.png">');
    expect(html).toContain(`<meta http-equiv="refresh" content="0;url=/#/token/${MINT}">`);
    const odd = await (await h.get('/t/%3Cscript%3E')).text();
    expect(odd).not.toContain('<script>location.replace("/#/token/<script>")');
    expect(odd).toContain('/#/token/%3Cscript%3E');
  });
});
