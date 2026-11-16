import { PassThrough } from 'node:stream';
import type { Launchpads } from '@soltoolkit/launchpad-sdk';
import { NoVenueError } from '@soltoolkit/launchpad-sdk';
import type { Rpc } from '@soltoolkit/rpc';
import { describe, expect, it } from 'vitest';
import { InvalidArguments, MAX_BATCH, RPC, TOOLS, checkArguments, createMcpServer, parseMessages, serveStdio, type JsonRpcResponse, type McpServer } from '../src';

const MINT = 'FWFxnxR1Esvv6Ebcntr357ri1mucV5FiKTG1kEiBpump';
const SIGNATURE = '4YSbm9KCpDV2orrQPeXg41hw9tzdSfNLe3ehJzqkPNxoTgepXwKWZhcjSbtkwFqzNKKCxNNnpL9XFKsDQt3u3gVc';

interface Fakes {
  rpc?: (method: string, params: unknown[]) => unknown;
  quote?: Launchpads['quote'];
  feed?: boolean;
  maxConcurrentCalls?: number;
}

function server(fakes: Fakes = {}): { mcp: McpServer; calls: string[] } {
  const calls: string[] = [];
  const rpc: Rpc = {
    async call<T>(method: string, params: unknown[]): Promise<T> {
      calls.push(method);
      return (fakes.rpc ? fakes.rpc(method, params) : null) as T;
    },
  };
  const launchpads = { quote: fakes.quote ?? (async () => { throw new Error('no quote faked'); }) } as unknown as Launchpads;
  const feed = fakes.feed ? { latest: async (limit: number) => [{ address: MINT, symbol: 'ZOP', price: null }].slice(0, limit), trending: async () => [] } : null;
  return { mcp: createMcpServer({ rpcUrl: 'http://rpc.invalid', rpc, launchpads, feed, maxConcurrentCalls: fakes.maxConcurrentCalls }), calls };
}

let nextId = 0;
const call = async (mcp: McpServer, name: string, args: unknown = {}): Promise<{ isError?: boolean; structuredContent?: Record<string, unknown>; content: { text: string }[] }> => {
  const response = await mcp.handle({ jsonrpc: '2.0', id: ++nextId, method: 'tools/call', params: { name, arguments: args } });
  return response!.result as never;
};
const errorOf = (result: Awaited<ReturnType<typeof call>>): { code: string; message: string; details?: unknown } => result.structuredContent!['error'] as never;

describe('the protocol', () => {
  it('initializes, echoing a version it speaks and offering the newest otherwise', async () => {
    const { mcp } = server();
    const known = await mcp.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } });
    expect(known!.result).toMatchObject({ protocolVersion: '2024-11-05', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'soltoolkit' } });
    const unknown = await mcp.handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
    expect((unknown!.result as { protocolVersion: string }).protocolVersion).toBe('2025-06-18');
    expect((await mcp.handle({ jsonrpc: '2.0', id: 3, method: 'ping' }))!.result).toEqual({});
  });

  it('says nothing to a notification and refuses a method it does not have', async () => {
    const { mcp } = server();
    expect(await mcp.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    expect((await mcp.handle({ jsonrpc: '2.0', id: 1, method: 'resources/list' }))!.error).toMatchObject({ code: RPC.METHOD_NOT_FOUND });
    expect((await mcp.handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'send_transaction' } }))!.error).toMatchObject({ code: RPC.INVALID_PARAMS });
    expect((await mcp.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: {} }))!.error).toMatchObject({ code: RPC.INVALID_PARAMS });
  });

  it('lists only tools that read, and the feed tools only with a feed', async () => {
    const without = server().mcp.tools;
    expect(without.map((t) => t.name)).toEqual(['launchpad_quote', 'token_safety', 'holder_map', 'identify_trading_app', 'list_trading_apps', 'wallet_performance']);
    expect(server({ feed: true }).mcp.tools.map((t) => t.name)).toContain('latest_launches');
    for (const tool of server({ feed: true }).mcp.tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(tool.description.length).toBeGreaterThan(40);
    }
    // No tool name suggests it writes.
    expect(TOOLS.some((t) => /send|sign|swap|buy|sell|transfer|withdraw|place|order/.test(t.name))).toBe(false);
  });

  it('parses one message or a batch, and answers a bad element without losing the good ones', async () => {
    const { mcp } = server();
    const answer = (await mcp.handleBody([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { nope: true }, { jsonrpc: '2.0', method: 'notifications/initialized' }])) as JsonRpcResponse[];
    expect(answer).toHaveLength(2);
    expect(answer[0]).toMatchObject({ id: 1, result: {} });
    expect(answer[1]).toMatchObject({ id: null, error: { code: RPC.INVALID_REQUEST } });
    expect(await mcp.handleBody({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    expect(() => parseMessages([])).toThrow(/empty batch/);
    expect(() => parseMessages(Array.from({ length: MAX_BATCH + 1 }, () => ({})))).toThrow(/at most/);
    expect(parseMessages({ jsonrpc: '2.0', id: {}, method: 'x' }).items[0]).toBeInstanceOf(Error);
  });
});

describe('arguments', () => {
  const schema = TOOLS.find((t) => t.name === 'launchpad_quote')!.input;

  it('accepts what the schema describes', () => {
    expect(checkArguments(schema, { mint: MINT, side: 'buy', amountIn: '10000000', slippageBps: 100 })).toEqual({ mint: MINT, side: 'buy', amountIn: '10000000', slippageBps: 100 });
    expect(checkArguments(schema, { mint: MINT, side: 'sell', amountIn: '1', wallet: null })).toEqual({ mint: MINT, side: 'sell', amountIn: '1' });
  });

  it('refuses unknown names, missing ones and wrong shapes', () => {
    const bad = (args: unknown): string => {
      try {
        checkArguments(schema, args);
        return 'accepted';
      } catch (error) {
        return error instanceof InvalidArguments ? error.message : 'threw something else';
      }
    };
    expect(bad({ side: 'buy', amountIn: '1' })).toContain('"mint" is required');
    expect(bad({ mint: MINT, side: 'buy', amountIn: '1', privateKey: 'x' })).toContain('unknown name "privateKey"');
    expect(bad({ mint: 'short', side: 'buy', amountIn: '1' })).toContain('mint does not have the expected form');
    expect(bad({ mint: MINT, side: 'hold', amountIn: '1' })).toContain('one of: buy, sell');
    expect(bad({ mint: MINT, side: 'buy', amountIn: '0' })).toContain('amountIn');
    expect(bad({ mint: MINT, side: 'buy', amountIn: 5 })).toContain('must be a string');
    expect(bad({ mint: MINT, side: 'buy', amountIn: '1', slippageBps: 1.5 })).toContain('whole number');
    expect(bad({ mint: MINT, side: 'buy', amountIn: '1', slippageBps: 9000 })).toContain('at most 5000');
    expect(bad([])).toContain('must be an object');
  });
});

describe('tools', () => {
  it('quotes with amounts as strings, and says which venues were tried when none has the token', async () => {
    const quoted = server({ quote: async (request) => ({ venue: 'pumpfun', side: request.side, mint: request.mint, inAmount: request.amountIn, outAmount: 30877697777999n, minOutAmount: 29951366844659n, slippageBps: request.slippageBps, venueFeeLamports: 125000n, priceImpactBps: null, state: { secret: 1 }, quotedAt: 5 }) });
    const result = await call(quoted.mcp, 'launchpad_quote', { mint: MINT, side: 'buy', amountIn: '10000000' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ venue: 'pumpfun', side: 'buy', mint: MINT, inAmount: '10000000', outAmount: '30877697777999', minOutAmount: '29951366844659', slippageBps: 300, venueFeeLamports: '125000', priceImpactBps: null, quotedAt: 5, units: { in: 'lamports', out: 'raw token units' } });
    expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent);

    const none = server({ quote: async () => { throw new NoVenueError(MINT, [{ venue: 'pumpfun', code: 'NOT_FOUND', message: 'no curve' }] as never); } });
    const failed = await call(none.mcp, 'launchpad_quote', { mint: MINT, side: 'buy', amountIn: '1' });
    expect(failed.isError).toBe(true);
    expect(errorOf(failed)).toMatchObject({ code: 'NO_VENUE', details: { attempts: [{ venue: 'pumpfun', code: 'NOT_FOUND' }] } });
  });

  it('answers bad arguments as a tool error the agent can read, without calling anything', async () => {
    const { mcp, calls } = server();
    const result = await call(mcp, 'token_safety', { mint: 'nope' });
    expect(result.isError).toBe(true);
    expect(errorOf(result).code).toBe('INVALID_ARGUMENTS');
    expect(calls).toEqual([]);
  });

  it('names the app behind a transaction, or says it is unknown', async () => {
    const missing = server({ rpc: () => null });
    expect(errorOf(await call(missing.mcp, 'identify_trading_app', { signature: SIGNATURE })).code).toBe('NOT_FOUND');
    expect(missing.calls).toEqual(['getTransaction']);
    const unreadable = server({ rpc: () => ({ transaction: 'base64…' }) });
    expect(errorOf(await call(unreadable.mcp, 'identify_trading_app', { signature: SIGNATURE })).code).toBe('UNREADABLE');
  });

  it('lists the registry without its addresses', async () => {
    const result = await call(server().mcp, 'list_trading_apps');
    const apps = result.structuredContent!['apps'] as { id: string; name: string }[];
    expect(apps.length).toBeGreaterThan(20);
    expect(apps.find((a) => a.id === 'axiom')).toMatchObject({ name: 'Axiom' });
    expect(result.content[0]!.text).not.toMatch(/feeWallets|programs/);
  });

  it('scores a wallet from the trades given, reading nothing', async () => {
    const { mcp, calls } = server();
    const trades = [
      { ts: 1_000, token: 'A', side: 'buy', amount: 100, valueUsd: 100 },
      { ts: 2_000, token: 'A', side: 'sell', amount: 100, valueUsd: 250 },
      { ts: 3_000, token: 'B', side: 'buy', amount: 10, valueUsd: 50 },
    ];
    const result = await call(mcp, 'wallet_performance', { trades });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ trades: 3 });
    expect((result.structuredContent!['performance'] as { realizedPnlUsd: number }).realizedPnlUsd).toBe(150);
    expect(typeof result.structuredContent!['smartScore']).toBe('number');
    expect(calls).toEqual([]);
    expect(errorOf(await call(mcp, 'wallet_performance', { trades: [{ ts: 1, token: 'A', side: 'buy', amount: -1, valueUsd: 1 }] })).message).toContain('trades[0].amount');
  });

  it('serves the feed tools from the feed, with unknown figures left null', async () => {
    const { mcp } = server({ feed: true });
    const result = await call(mcp, 'latest_launches', { limit: 1 });
    expect(result.structuredContent).toEqual({ tokens: [{ address: MINT, symbol: 'ZOP', price: null }] });
    expect((await mcp.handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'latest_launches' } }))!.result).toBeDefined();
    expect((await server().mcp.handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'latest_launches' } }))!.error).toMatchObject({ code: RPC.INVALID_PARAMS });
  });

  it('refuses a call past the number it runs at once, and reports an endpoint error as a tool error', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = server({ maxConcurrentCalls: 1, rpc: async () => { await gate; return null; } });
    const first = call(slow.mcp, 'identify_trading_app', { signature: SIGNATURE });
    await Promise.resolve();
    expect(errorOf(await call(slow.mcp, 'identify_trading_app', { signature: SIGNATURE })).code).toBe('BUSY');
    release();
    expect(errorOf(await first).code).toBe('NOT_FOUND');
    expect(errorOf(await call(slow.mcp, 'identify_trading_app', { signature: SIGNATURE })).code).toBe('NOT_FOUND');

    const broken = server({ rpc: () => { throw new Error('socket hang up'); } });
    expect(errorOf(await call(broken.mcp, 'identify_trading_app', { signature: SIGNATURE }))).toMatchObject({ code: 'FAILED', message: 'socket hang up' });
  });
});

describe('transports', () => {
  it('answers over HTTP: POST only, JSON only, 202 for notifications, 429 when the host says so', async () => {
    const { mcp } = server();
    const post = (body: string, headers: Record<string, string> = {}): Request => new Request('http://localhost/mcp', { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });
    expect((await mcp.handleHttp(new Request('http://localhost/mcp'))).status).toBe(405);
    const ok = await mcp.handleHttp(post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(((await ok.json()) as { result: { tools: unknown[] } }).result.tools).toHaveLength(6);
    expect((await mcp.handleHttp(post(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })))).status).toBe(202);
    expect((await mcp.handleHttp(post('{not json'))).status).toBe(400);
    expect((await mcp.handleHttp(post('[]'))).status).toBe(400);
    expect((await mcp.handleHttp(post('{}', { 'content-length': '99999999' }))).status).toBe(413);
    const limited = await mcp.handleHttp(post('{}'), { limit: () => 12.2 });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('13');
  });

  it('answers over stdio, one line per message, and survives a line that is not JSON', async () => {
    const { mcp } = server();
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    const done = serveStdio(mcp, input, output);
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
    input.write('garbage\n\n');
    input.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    input.end(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
    await done;
    const lines = chunks.join('').trim().split('\n').map((line) => JSON.parse(line) as JsonRpcResponse);
    expect(lines).toHaveLength(3);
    expect(lines.find((l) => l.id === 1)!.result).toMatchObject({ serverInfo: { name: 'soltoolkit' } });
    expect(lines.find((l) => l.id === null)!.error).toMatchObject({ code: RPC.PARSE_ERROR });
    expect((lines.find((l) => l.id === 2)!.result as { tools: unknown[] }).tools).toHaveLength(6);
  });
});
