# soltoolkit Live

The toolkit working on Solana mainnet, in a browser. Every figure on it comes from the open-source soltoolkit packages, through the [demo API](../demo-api).

| Page | What it shows |
|---|---|
| Launches | New tokens on pump.fun, PumpSwap, Raydium LaunchLab and Meteora DBC as they happen, and the most traded of the last five minutes (with the launch feed connected) |
| Token check | A token's safety grade and its eight checks, its on-chain facts, a buy quote on its launchpad, and its holder map with clusters |
| Wallet | Realized profit at average cost, win rate, hold time and a 0–100 score from a wallet's trades |
| Trading apps | Which terminal, bot or wallet placed a transaction, and the registry of the apps it can name |
| Developers | The npm packages, the MCP server for AI agents, the API's routes and the repositories |

It has the soltoolkit look, shared with soltoolkit pay and hoodtoolkit Live: a near-black page, cards with a solid bottom edge, raised green pill buttons, pill tabs and round icon buttons, in DM Sans and DM Mono, with [Phosphor](https://phosphoricons.com) icons and no gradients. Tables, badges, alerts and code blocks are [ReUI](https://reui.io) components (Data Grid, Badge, Alert, Code Block) on shadcn/ui and Radix, styled through the same colours. It is dark only and laid out for a phone first.

The ReUI components in `src/components/reui` are copied from ReUI's registry by the shadcn CLI (`pnpm dlx shadcn@latest add @reui/<name>`) and kept as they come; the repository's lint skips them.

## Run it

```
pnpm install
SOLANA_RPC_URL=https://your-rpc.example PORT=8787 pnpm --filter @soltoolkit/demo-api start
pnpm --filter @soltoolkit/live dev          # http://localhost:5173, calling the API on 127.0.0.1:8787
```

`DEMO_API` points the development server at another API address.

## Build

```
pnpm --filter @soltoolkit/live build        # → dist/, static files
```

Serve `dist/` from the same origin as the demo API (a reverse proxy sending `/v1`, `/mcp` and `/health` to it), or set `VITE_API_URL` at build time to call an API elsewhere; the API allows cross-origin calls.

## What it needs from the RPC endpoint

Holder maps and the top-10 share use `getTokenLargestAccounts`, which most free public endpoints refuse. The page says so rather than guessing; an endpoint that serves the call fills them in. Launches and trending need the [launch feed](https://github.com/robelmit/soltoolkit-feed) and Redis beside the API.

## Tests

```
pnpm --filter @soltoolkit/live test
```

6 tests cover the number, amount and time formatting (unknown is never zero, base units converted exactly) and the page links. The site was also run against the demo API on Solana mainnet's public endpoint and checked in a browser on a desktop and a phone screen: a token's grade and facts, a launchpad quote, a wallet report, the registry in the paginated data grid, the highlighted code blocks.

## Licence

MIT
