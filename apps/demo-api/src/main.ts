/**
 * Starts the demo API on a plain Node HTTP server.
 *
 *   SOLANA_RPC_URL    required: the endpoint the routes read from
 *   PORT              default 8787
 *   HOST              default 127.0.0.1 (set 0.0.0.0 to listen on every interface)
 *   RATE_PER_MINUTE   points a client gets a minute (default 30)
 *   MAX_CONCURRENT    tool calls running at once (default 4)
 *   RPC_PER_SECOND    calls a second to the RPC endpoint (default 4, a pace for public endpoints)
 *   TRUST_PROXY       1 when exactly one reverse proxy you run sits in front: clients are then counted by the
 *                     address that proxy appended to X-Forwarded-For. Leave it unset otherwise, or any caller could
 *                     name its own address and escape the budget.
 *   REDIS_URL         optional: the launch feed's Redis; adds /v1/launches and /v1/trending
 */

import { DEFAULT_STREAM_KEY, FeedState, readRedisStream } from '@soltoolkit/bot-core';
import { createLaunchpads } from '@soltoolkit/launchpad-sdk';
import { createRpc } from '@soltoolkit/rpc';
import { createServer, type IncomingMessage } from 'node:http';
import { createApp } from './app';

const log = (level: string, message: string, fields: Record<string, unknown> = {}): void => console.error(JSON.stringify({ at: new Date().toISOString(), level, message, ...fields }));

function settings(env: NodeJS.ProcessEnv) {
  const get = (name: string): string | undefined => env[name]?.trim() || undefined;
  const whole = (name: string, fallback: number, min: number, max: number): number => {
    const raw = get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} is a whole number from ${min} to ${max}`);
    return value;
  };
  const rpcUrl = get('SOLANA_RPC_URL');
  if (!rpcUrl) throw new Error('SOLANA_RPC_URL is required: the Solana JSON-RPC endpoint the routes read from');
  if (!/^https?:\/\//.test(rpcUrl)) throw new Error('SOLANA_RPC_URL must start with http:// or https://');
  const trust = get('TRUST_PROXY');
  if (trust !== undefined && trust !== '0' && trust !== '1') throw new Error('TRUST_PROXY is 1 or 0');
  const redisUrl = get('REDIS_URL');
  if (redisUrl && !/^rediss?:\/\//.test(redisUrl)) throw new Error('REDIS_URL must start with redis:// or rediss://');
  return {
    rpcUrl,
    port: whole('PORT', 8787, 1, 65_535),
    host: get('HOST') ?? '127.0.0.1',
    ratePerMinute: whole('RATE_PER_MINUTE', 30, 1, 100_000),
    maxConcurrent: whole('MAX_CONCURRENT', 4, 1, 256),
    rpcPerSecond: whole('RPC_PER_SECOND', 4, 0, 10_000),
    trustProxy: trust === '1',
    redisUrl,
    streamKey: get('FEED_STREAM_KEY') ?? DEFAULT_STREAM_KEY,
  };
}

/** Who the budget is counted by. */
function clientOf(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const header = req.headers['x-forwarded-for'];
    const list = (Array.isArray(header) ? header.join(',') : (header ?? '')).split(',').map((part) => part.trim()).filter(Boolean);
    // The last entry is the one our own proxy appended; anything before it is whatever the caller sent.
    const last = list[list.length - 1];
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

async function main(): Promise<void> {
  const config = settings(process.env);
  const stop = new AbortController();

  let feed: FeedState | null = null;
  if (config.redisUrl) {
    const { Redis } = await import('ioredis');
    const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    redis.on('error', (error: Error) => log('warn', 'redis', { error: error.message }));
    stop.signal.addEventListener('abort', () => redis.disconnect(), { once: true });
    const state = new FeedState();
    feed = state;
    void readRedisStream(redis as unknown as Parameters<typeof readRedisStream>[0], (event) => state.apply(event), stop.signal, { key: config.streamKey });
  }

  const app = createApp({
    rpcUrl: config.rpcUrl,
    rpc: createRpc({ url: config.rpcUrl, requestsPerSecond: config.rpcPerSecond }),
    launchpads: createLaunchpads({ rpcUrl: config.rpcUrl }),
    feed,
    ratePerMinute: config.ratePerMinute,
    maxConcurrent: config.maxConcurrent,
  });

  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > 1_100_000) {
          res.writeHead(413).end();
          req.destroy();
          return;
        }
        chunks.push(chunk as Buffer);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(name, value);
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, { method: req.method, headers, ...(hasBody ? { body: Buffer.concat(chunks) } : {}) });
      const response = await app.handle(request, clientOf(req, config.trustProxy));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    })().catch((error: unknown) => {
      log('error', 'request failed', { error: error instanceof Error ? error.message : String(error) });
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":{"code":"FAILED","message":"The request could not be answered."}}');
    });
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;

  const shutdown = (): void => {
    if (stop.signal.aborted) return;
    log('info', 'stopping');
    stop.abort();
    server.close();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  server.listen(config.port, config.host, () => log('info', 'listening', { host: config.host, port: config.port, ratePerMinute: config.ratePerMinute, feed: feed !== null, trustProxy: config.trustProxy }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
