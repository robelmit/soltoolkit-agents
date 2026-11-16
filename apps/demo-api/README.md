# Demo API

A small, read-only HTTP API over the soltoolkit packages, with a budget per client. It is the free public endpoint of the project, and it is also everything you need to run the same API yourself.

It reads public chain data through one Solana RPC endpoint. It holds no key, signs nothing, and stores nothing about a caller.

## Run it

```
SOLANA_RPC_URL=https://your-rpc.example pnpm --filter @soltoolkit/demo-api start
curl http://127.0.0.1:8787/
```

`GET /` lists the routes.

## Routes

Every answer is JSON: `{ "data": … }` or `{ "error": { "code", "message" } }`.

| Route | Cost | What |
|---|---|---|
| `GET /v1/quote?mint=&side=buy\|sell&amountIn=&slippageBps=&wallet=` | 1 | A quote on pump.fun, PumpSwap or Meteora DBC. `amountIn` is base units: lamports for a buy, raw token units for a sell |
| `GET /v1/tokens/{mint}/safety?creator=` | 2 | A graded safety report |
| `GET /v1/tokens/{mint}/holders?walk=` | 10 | The largest holders, the transfers among them, and their clusters |
| `GET /v1/transactions/{signature}/app` | 1 | Which trading app placed a transaction |
| `GET /v1/apps` | 1 | The trading apps the registry can name |
| `GET /v1/launches?limit=` | 1 | The newest launchpad tokens (with the launch feed) |
| `GET /v1/trending?limit=` | 1 | The most traded launchpad tokens of the last five minutes (with the launch feed) |
| `POST /v1/wallets/performance` | 2 | Realized PnL, win rate and a score from the trades in the body: `{ "trades": [{ "ts", "token", "side", "amount", "valueUsd" }] }` |
| `POST /mcp` | 2 | The same tools over the Model Context Protocol |
| `GET /health` | — | `{ "ok": true, "feed": … }` |

Each route is one tool of [`@soltoolkit/mcp`](../../packages/mcp); the arguments and the answers are the same.

- Unknown values are `null`, never zero.
- Token amounts are whole numbers of base units, as strings.
- Cross-origin requests are allowed, so a web page can call it.

### Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_ARGUMENTS` | The message says which argument and why |
| 404 | `NOT_FOUND`, `NOT_A_TOKEN`, `NO_VENUE`, `NO_ROUTE` | No such transaction, token, venue or route |
| 405 | `METHOD_NOT_ALLOWED` | |
| 422 | `UNSUPPORTED` | For example a token quoted in a coin other than SOL |
| 429 | `RATE_LIMITED` | Over the budget; `Retry-After` says how many seconds |
| 502 | `RPC_ERROR`, `HOLDERS_UNAVAILABLE`, `UNREADABLE` | The RPC endpoint could not serve the read |
| 503 | `BUSY` | Too many reads running; try again shortly |
| 500 | `FAILED` | Anything else. The message is general on purpose |

## Budget

A client gets `RATE_PER_MINUTE` points a minute (30 by default), refilled evenly. Each route costs the points in the table; a holder map costs the most because it makes the most RPC reads.

Answers are reused for a short time, so the same question is not read from the chain twice in a row: 2 seconds for a quote, 1 minute for a safety report, 5 minutes for a holder map, 10 minutes for a transaction's app. A failed read is not kept.

At most `MAX_CONCURRENT` reads run at once (4 by default). Past that the answer is 503, not a queue.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `SOLANA_RPC_URL` | — | Required |
| `PORT`, `HOST` | `8787`, `127.0.0.1` | Where it listens. Set `HOST=0.0.0.0` to listen on every interface |
| `RATE_PER_MINUTE` | `30` | Points per client per minute |
| `MAX_CONCURRENT` | `4` | Reads running at once |
| `RPC_PER_SECOND` | `4` | Calls a second to the RPC endpoint; raise it on your own node, `0` turns pacing off |
| `TRUST_PROXY` | unset | `1` when exactly one reverse proxy of yours is in front: clients are counted by the address it appended to `X-Forwarded-For`. Without a proxy leave it unset, or a caller could name any address and escape the budget |
| `REDIS_URL`, `FEED_STREAM_KEY` | — | The launch feed's Redis; adds `/v1/launches` and `/v1/trending` |

## Limits

- The budget and the cache are in memory: one process, and a restart forgets both.
- A client is an IP address. Callers behind one address share a budget.
- There are no API keys. For a paid or private service, put your own authentication in front.
- A holder map of a widely held token can be refused by the RPC endpoint; the answer says so.

## Tests

```
pnpm --filter @soltoolkit/demo-api test
```

12 tests call the app as a function from `Request` to `Response`. The server was also started locally against a public mainnet endpoint and called with curl: the index, a live quote, a safety report, the MCP endpoint, a 400, and the 429 after the budget ran out.

## Licence

MIT
