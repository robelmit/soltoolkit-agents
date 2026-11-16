# soltoolkit-agents

Solana launchpad data for AI agents and for apps, from the team behind the Hexa trading terminal: a read-only MCP server and a small rate-limited HTTP API over the same tools.

## What is here

| Piece | What it does |
|---|---|
| [`@soltoolkit/mcp`](packages/mcp) | A Model Context Protocol server over stdio or HTTP: quote a launchpad trade, grade a token, map its holders, name the app behind a transaction, score a wallet. No key, and no tool that signs or sends |
| [demo-api](apps/demo-api) | The same tools as plain HTTP routes, with a budget per client and a short cache in front of the RPC endpoint |

[docs/architecture.md](docs/architecture.md) shows how the soltoolkit pieces fit together.

## Principles

- **Nothing here signs, sends or holds a key.**
- **Unknown is never zero.** A value that could not be read stays `null`; it is never counted as a pass or as nothing.
- **Refuse rather than guess.** A failed read is an error, not "not found".
- **No API key needed.** Everything runs against a plain Solana JSON-RPC endpoint you choose.

## Develop

Node 22.13 or newer and pnpm, to work on the repository. The published packages run on Node 20 or newer.

This repository uses packages of [soltoolkit-bots](https://github.com/robelmit/soltoolkit-bots) and [soltoolkit-sdk](https://github.com/robelmit/soltoolkit-sdk) and [soltoolkit-insights](https://github.com/robelmit/soltoolkit-insights). Until those are on npm, clone them beside this one and run `pnpm install && pnpm build` there first; `.pnpmfile.cjs` then links the local copies.

```bash
pnpm install
pnpm check        # build, typecheck, test, lint
```

## The soltoolkit family

| Repository | What it holds |
|---|---|
| [soltoolkit-sdk](https://github.com/robelmit/soltoolkit-sdk) | Launchpad trade SDK and the shared RPC client |
| [soltoolkit-feed](https://github.com/robelmit/soltoolkit-feed) | The launch feed: a Rust indexer for launches, trades and migrations |
| [soltoolkit-insights](https://github.com/robelmit/soltoolkit-insights) | Token safety, holder maps and their viewer, wallet PnL, the trading-app registry |
| [soltoolkit-bots](https://github.com/robelmit/soltoolkit-bots) | Telegram and Discord community bots |
| **soltoolkit-agents** (this one) | A read-only MCP server for AI agents, and an HTTP API |

See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute and [SECURITY.md](SECURITY.md) to report a vulnerability.

## Licence

[MIT](LICENSE)
