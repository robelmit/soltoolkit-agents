# @soltoolkit/mcp

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server for Solana launchpad tokens. An AI agent can ask it to quote a trade, grade a token, map its holders, name the app behind a transaction, or score a wallet.

It holds no key. It has no tool that signs, sends or changes anything.

## Use it from an agent

Add it to your MCP client's configuration (the file and its exact shape depend on the client):

```json
{
  "mcpServers": {
    "soltoolkit": {
      "command": "npx",
      "args": ["-y", "@soltoolkit/mcp"],
      "env": { "SOLANA_RPC_URL": "https://your-rpc.example" }
    }
  }
}
```

`SOLANA_RPC_URL` is required. The server stops at start without it; it does not fall back to an endpoint you did not choose.

## Tools

| Tool | What it answers | Reads |
|---|---|---|
| `launchpad_quote` | A buy or sell quote on pump.fun, PumpSwap or Meteora DBC: venue, expected output, least output at your slippage, venue fee, price impact | RPC |
| `token_safety` | A graded safety report. A check that could not run is "not verified", never a pass | RPC |
| `holder_map` | The largest holders, the transfers among them, and the clusters they form | RPC, bounded |
| `identify_trading_app` | Which terminal, bot or wallet app placed a transaction, and the evidence | RPC |
| `list_trading_apps` | The apps the registry can name | Nothing |
| `wallet_performance` | Realized PnL, win rate, hold time and a score, from trades you supply | Nothing |
| `latest_launches` | The newest launchpad tokens | The launch feed |
| `trending_tokens` | The most traded launchpad tokens of the last five minutes | The launch feed |

The last two are offered only when the server has a [launch feed](https://github.com/robelmit/soltoolkit-feed): set `REDIS_URL` to the feed's Redis (and install `ioredis`).

Each tool is a thin call into a soltoolkit package: [`launchpad-sdk`](https://github.com/robelmit/soltoolkit-sdk/tree/main/packages/launchpad-sdk), [`token-safety`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/token-safety), [`holder-map`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/holder-map), [`app-registry`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/app-registry), [`wallet-pnl`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/wallet-pnl).

## What an agent can rely on

- **Unknown is null, never zero.** A null share, price or check means "not known".
- **Amounts are strings.** Token amounts are whole numbers of base units as decimal strings, so no digit is lost in JSON.
- **A tool that cannot do the thing says why.** The result has `isError: true` and `{ "error": { "code", "message" } }`. For example `NO_VENUE` lists which launchpads were tried, and `HOLDERS_UNAVAILABLE` says the endpoint refused the holder read.
- **Arguments are checked against the published schema.** The `inputSchema` a client reads is the same object every call is checked with. Unknown argument names are refused.
- **Every tool is annotated read-only** (`readOnlyHint: true`, `destructiveHint: false`).

## Over HTTP

`handleHttp` takes a web-standard `Request` and returns a `Response` (Streamable HTTP, stateless, JSON answers):

```ts
import { createServer } from 'node:http';
import { createMcpServer } from '@soltoolkit/mcp';

const mcp = createMcpServer({ rpcUrl: process.env.SOLANA_RPC_URL! });

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const request = new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
  const response = await mcp.handleHttp(request, {
    // Return seconds to refuse with 429; null to let the request through. Count by client here.
    limit: () => null,
  });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(8787);
```

It has no authentication of its own. Put it behind your own, or keep it on a private network. If you expose it, use the `limit` hook: every tool call can cost reads on your RPC endpoint.

## As plain functions

The same tools, with the same bounds and argument checks, without the protocol: for a bot or a script of your own.

```ts
import { createToolRunner } from '@soltoolkit/mcp';

const tools = createToolRunner({ rpcUrl: 'https://your-rpc.example' });
const quote = await tools.run('launchpad_quote', { mint: '<token>', side: 'buy', amountIn: '500000000' });
```

A tool that could not do the thing throws a `ToolCallError` whose `code` is the one the server would have answered (`NO_VENUE`, `NOT_A_TOKEN`, `INVALID_ARGUMENTS`, `BUSY`, `RPC_ERROR`, …). The soltoolkit bots use this for `/quote`, `/safety`, `/holders` and `/app`.

## Bounds

| Bound | Default | Option |
|---|---|---|
| Tool calls running at once; a call past it is refused with `BUSY` | 4 | `maxConcurrentCalls` |
| Holders a `holder_map` walks | 20 | `limits.maxHolderWalk` |
| RPC calls one `holder_map` walk makes | 150 | `limits.maxCallsPerTool` |
| Trades in one `wallet_performance` call | 5,000 | — |
| Messages in one HTTP batch | 16 | — |
| HTTP body | 1 MiB | — |

## What it does not do

- No trading tools. Building a transaction for an agent's own wallet to sign is a separate piece of work.
- No resources, prompts or server-sent streams: tools only.
- No wallet history: `wallet_performance` scores the trades you give it.
- `launchpad_quote` covers the venues of the launchpad SDK, and tokens quoted in SOL.

## Tests

```
pnpm --filter @soltoolkit/mcp test
```

17 tests cover the protocol, the argument checks, each tool against faked reads, both transports, and the tools as plain functions. The server was also run over stdio against a public mainnet endpoint: it quoted two tokens that were trading on pump.fun at that moment, refused one quoted in another coin with the reason, graded a token, and read a transaction.

## Licence

MIT
