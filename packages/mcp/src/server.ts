/**
 * The MCP server: Model Context Protocol, stateless, with two transports.
 *
 * - **stdio**: one JSON-RPC message per line on standard input, answers on
 *   standard output. This is how a desktop agent starts a local server.
 * - **HTTP**: `handleHttp` takes a web-standard `Request` and returns a
 *   `Response` (Streamable HTTP, JSON answers only). There is no
 *   server-initiated stream (GET answers 405) and no session to end.
 *
 * Every tool reads. The server holds no key and has no tool that signs,
 * sends or changes anything.
 */

import { createLaunchpads, type Launchpads } from '@soltoolkit/launchpad-sdk';
import { RpcError, createRpc, type Rpc } from '@soltoolkit/rpc';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { JsonRpcError, RPC, isNotification, parseMessages, rpcError, rpcResult, type JsonRpcRequest, type JsonRpcResponse } from './jsonrpc';
import { InvalidArguments, checkArguments } from './schema';
import { DEFAULT_TOOL_LIMITS, TOOLS, ToolFailure, type LaunchSource, type Tool, type ToolContext, type ToolLimits } from './tools';

/** Newest first; a client's version is echoed when the server speaks it, else the newest. */
export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
export const MCP_SERVER_INFO = { name: 'soltoolkit', title: 'Soltoolkit: Solana launchpad tools', version: '0.1.0' } as const;
export const MCP_INSTRUCTIONS =
  'Read-only tools for Solana launchpad tokens: quote a trade on pump.fun, PumpSwap or Meteora DBC, grade a token, map its holders, name the app behind a transaction, and score a wallet from its trades. ' +
  'Nothing here signs or sends a transaction. Unknown values are null and never zero: a null share, price or check means "not known", not "none". ' +
  'Token amounts are whole numbers of base units given as strings.';

/** The largest HTTP body read, in bytes. */
const MAX_BODY_BYTES = 1_048_576;

export interface McpServerOptions {
  /** A Solana JSON-RPC endpoint. */
  readonly rpcUrl: string;
  /** Replace the RPC client (tests, or a client of your own). */
  readonly rpc?: Rpc;
  /** Replace the launchpad SDK (tests). */
  readonly launchpads?: Launchpads;
  /** A launch feed; with it `latest_launches` and `trending_tokens` are offered. */
  readonly feed?: LaunchSource | null;
  readonly limits?: Partial<ToolLimits>;
  /** Tool calls running at once, at most (default 4); a call past it is refused, not queued. */
  readonly maxConcurrentCalls?: number;
}

export interface ToolDescriptor {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Tool['input'];
  readonly annotations: { readonly title: string; readonly readOnlyHint: true; readonly destructiveHint: false; readonly idempotentHint: true; readonly openWorldHint: true };
}

interface ToolResult {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
  readonly structuredContent?: Record<string, unknown>;
  readonly isError?: boolean;
}

export interface HttpOptions {
  /**
   * Called once per HTTP request before anything is read. Return a number of seconds to refuse the request with
   * 429 and that Retry-After; return null to let it through. This is where a public endpoint counts by client.
   */
  readonly limit?: (request: Request) => number | null | Promise<number | null>;
}

export interface McpServer {
  /** The tools this server offers. */
  readonly tools: readonly ToolDescriptor[];
  /** One parsed JSON-RPC message in, its answer out; null for a notification. */
  handle(message: JsonRpcRequest): Promise<JsonRpcResponse | null>;
  /** A request body (one message or a batch) in, the answer body out; null when only notifications came. */
  handleBody(body: unknown): Promise<JsonRpcResponse | JsonRpcResponse[] | null>;
  /** Streamable HTTP: POST a message or a batch. */
  handleHttp(request: Request, options?: HttpOptions): Promise<Response>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON with bigints as decimal strings, so no amount loses digits on the way out. */
const toJson = (value: unknown): string => JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));

const describe = (tool: Tool): ToolDescriptor => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: tool.input,
  annotations: { title: tool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
});

const failure = (code: string, message: string, details?: unknown): ToolResult => {
  const body = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return { content: [{ type: 'text', text: toJson(body) }], structuredContent: body, isError: true };
};

export function createMcpServer(options: McpServerOptions): McpServer {
  const context: ToolContext = {
    rpc: options.rpc ?? createRpc({ url: options.rpcUrl }),
    launchpads: options.launchpads ?? createLaunchpads({ rpcUrl: options.rpcUrl }),
    feed: options.feed ?? null,
    limits: { ...DEFAULT_TOOL_LIMITS, ...options.limits },
  };
  const offered = TOOLS.filter((tool) => !tool.needsFeed || context.feed !== null);
  const byName = new Map(offered.map((tool) => [tool.name, tool]));
  const maxConcurrent = Math.max(1, options.maxConcurrentCalls ?? 4);
  let running = 0;

  async function callTool(params: unknown): Promise<ToolResult> {
    const p = isRecord(params) ? params : {};
    const name = p['name'];
    if (typeof name !== 'string') throw new JsonRpcError(RPC.INVALID_PARAMS, 'tools/call needs a tool name');
    const tool = byName.get(name);
    if (!tool) throw new JsonRpcError(RPC.INVALID_PARAMS, `Unknown tool: ${name}`);
    let args: Record<string, unknown>;
    try {
      args = checkArguments(tool.input, p['arguments'] ?? {});
    } catch (error) {
      if (error instanceof InvalidArguments) return failure('INVALID_ARGUMENTS', error.message);
      throw error;
    }
    if (running >= maxConcurrent) return failure('BUSY', 'The server is running as many tool calls as it allows at once. Try again in a moment.');
    running += 1;
    try {
      // The answer goes through JSON once here, so `structuredContent` is exactly what the text says.
      const data: unknown = JSON.parse(toJson(await tool.run(args, context)));
      return { content: [{ type: 'text', text: JSON.stringify(data) }], ...(isRecord(data) ? { structuredContent: data } : {}) };
    } catch (error) {
      // A tool that could not do the thing is a tool error (isError), not a protocol failure: the agent reads the code and acts on it.
      if (error instanceof ToolFailure) return failure(error.code, error.message, error.details);
      if (error instanceof RpcError) return failure('RPC_ERROR', `The Solana RPC endpoint answered with an error: ${error.message}`);
      return failure('FAILED', error instanceof Error ? error.message : 'The tool failed.');
    } finally {
      running -= 1;
    }
  }

  async function handle(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    // notifications/initialized, notifications/cancelled, …: accepted, nothing to say.
    if (isNotification(message)) return null;
    const id = message.id ?? null;
    try {
      switch (message.method) {
        case 'initialize': {
          const requested = isRecord(message.params) ? message.params['protocolVersion'] : undefined;
          const version = typeof requested === 'string' && (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0];
          return rpcResult(id, { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: MCP_SERVER_INFO, instructions: MCP_INSTRUCTIONS });
        }
        case 'ping':
          return rpcResult(id, {});
        case 'tools/list':
          return rpcResult(id, { tools: offered.map(describe) });
        case 'tools/call':
          return rpcResult(id, await callTool(message.params));
        default:
          throw new JsonRpcError(RPC.METHOD_NOT_FOUND, `Method not found: ${message.method}`);
      }
    } catch (error) {
      if (error instanceof JsonRpcError) return rpcError(id, error);
      return rpcError(id, { code: RPC.INTERNAL_ERROR, message: 'Internal error' });
    }
  }

  async function handleBody(body: unknown): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    const parsed = parseMessages(body);
    const responses: JsonRpcResponse[] = [];
    for (const item of parsed.items) {
      if (item instanceof JsonRpcError) {
        responses.push(rpcError(null, item));
        continue;
      }
      const response = await handle(item);
      if (response) responses.push(response);
    }
    if (responses.length === 0) return null;
    return parsed.batch ? responses : responses[0]!;
  }

  const json = (body: unknown, status: number, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

  async function handleHttp(request: Request, http: HttpOptions = {}): Promise<Response> {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    const retryAfter = await http.limit?.(request);
    if (typeof retryAfter === 'number') return json(rpcError(null, { code: RPC.RATE_LIMITED, message: 'Too many requests' }), 429, { 'Retry-After': String(Math.max(1, Math.ceil(retryAfter))) });
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) return json(rpcError(null, { code: RPC.INVALID_REQUEST, message: 'The body is too large' }), 413);
    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json(rpcError(null, { code: RPC.INVALID_REQUEST, message: 'The body is too large' }), 413);
      body = JSON.parse(text);
    } catch {
      return json(rpcError(null, { code: RPC.PARSE_ERROR, message: 'The body is not JSON' }), 400);
    }
    try {
      const answer = await handleBody(body);
      if (answer === null) return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
      return json(answer, 200);
    } catch (error) {
      if (error instanceof JsonRpcError) return json(rpcError(null, error), 400);
      return json(rpcError(null, { code: RPC.INTERNAL_ERROR, message: 'Internal error' }), 500);
    }
  }

  return { tools: offered.map(describe), handle, handleBody, handleHttp };
}

/**
 * Serves the stdio transport until the input ends: one JSON-RPC message per line in, one answer per line out.
 * Nothing but protocol messages is ever written to `output`.
 */
export async function serveStdio(server: McpServer, input: Readable, output: Writable): Promise<void> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  const write = (message: unknown): void => void output.write(`${JSON.stringify(message)}\n`);
  const pending = new Set<Promise<void>>();
  for await (const line of lines) {
    if (!line.trim()) continue;
    let body: unknown;
    try {
      body = JSON.parse(line);
    } catch {
      write(rpcError(null, { code: RPC.PARSE_ERROR, message: 'The line is not JSON' }));
      continue;
    }
    // Messages are answered as they finish, so a slow tool call does not hold a ping back.
    const task = server
      .handleBody(body)
      .then((answer) => {
        if (answer !== null) write(answer);
      })
      .catch((error: unknown) => write(rpcError(null, error instanceof JsonRpcError ? error : { code: RPC.INTERNAL_ERROR, message: 'Internal error' })))
      .finally(() => pending.delete(task));
    pending.add(task);
  }
  await Promise.all(pending);
}
