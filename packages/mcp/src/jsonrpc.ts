/**
 * JSON-RPC 2.0 framing for the MCP server: message parsing and the two
 * response shapes. Pure — no transport, no tools — so it is tested without a
 * request.
 */

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  /** Absent on a notification: the client expects no answer. */
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcErrorBody {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcResponse {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly result?: unknown;
  readonly error?: JsonRpcErrorBody;
}

export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  /** Server-defined: the caller is over the rate limit; the HTTP answer carries Retry-After. */
  RATE_LIMITED: -32002,
} as const;

/** Messages one HTTP request may carry. Every tool call can cost RPC reads, so a batch is bounded. */
export const MAX_BATCH = 16;

export class JsonRpcError extends Error {
  readonly code: number;
  readonly data: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'JsonRpcError';
    this.code = code;
    this.data = data;
  }
}

/** True for a message the client expects no answer to: one without an `id` member at all. */
export function isNotification(message: JsonRpcRequest): boolean {
  return !Object.prototype.hasOwnProperty.call(message, 'id');
}

function parseMessage(raw: unknown): JsonRpcRequest {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new JsonRpcError(RPC.INVALID_REQUEST, 'A JSON-RPC message is an object');
  const m = raw as Record<string, unknown>;
  if (m['jsonrpc'] !== '2.0') throw new JsonRpcError(RPC.INVALID_REQUEST, 'jsonrpc must be "2.0"');
  const method = m['method'];
  if (typeof method !== 'string' || method === '') throw new JsonRpcError(RPC.INVALID_REQUEST, 'method must be a non-empty string');
  const hasId = Object.prototype.hasOwnProperty.call(m, 'id');
  const id = m['id'];
  if (hasId && !(typeof id === 'string' || typeof id === 'number' || id === null)) throw new JsonRpcError(RPC.INVALID_REQUEST, 'id must be a string, a number or null');
  const params = m['params'];
  if (params !== undefined && (typeof params !== 'object' || params === null)) throw new JsonRpcError(RPC.INVALID_PARAMS, 'params must be an object or an array');
  return { jsonrpc: '2.0', ...(hasId ? { id: id as JsonRpcId } : {}), method, ...(params !== undefined ? { params } : {}) };
}

/**
 * The messages in a request body: one, or a batch. A malformed element of a
 * batch becomes its own error (answered with a null id, as JSON-RPC says)
 * without taking the well-formed ones with it.
 */
export function parseMessages(body: unknown): { readonly items: ReadonlyArray<JsonRpcRequest | JsonRpcError>; readonly batch: boolean } {
  const batch = Array.isArray(body);
  const raw: unknown[] = batch ? (body as unknown[]) : [body];
  if (batch && raw.length === 0) throw new JsonRpcError(RPC.INVALID_REQUEST, 'An empty batch is not a request');
  if (batch && raw.length > MAX_BATCH) throw new JsonRpcError(RPC.INVALID_REQUEST, `A batch holds at most ${MAX_BATCH} messages`);
  return {
    batch,
    items: raw.map((item) => {
      try {
        return parseMessage(item);
      } catch (error) {
        if (error instanceof JsonRpcError) return error;
        throw error;
      }
    }),
  };
}

export function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function rpcError(id: JsonRpcId, error: JsonRpcErrorBody): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code: error.code, message: error.message, ...(error.data !== undefined ? { data: error.data } : {}) } };
}
