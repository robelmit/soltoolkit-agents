# How the pieces fit

Everything in the soltoolkit repositories reads public Solana data and turns it into something a builder can use. Nothing signs, sends or holds a key.

```
                      Solana RPC endpoint (yours)                 Yellowstone gRPC (optional)
                               │                                            │
        ┌──────────────────────┼─────────────────────────┐                  │
        │                      │                         │                  │
   @soltoolkit/rpc      launchpad-sdk              launch feed (Rust)  ◄──────┘
   paced, retrying     quote · build · verify     new tokens, trades, curve, migrations
        │                      │                         │
        ├── token-safety       │                         ├── standard output (JSON lines)
        ├── holder-map         │                         └── Redis Stream  stream:market:solana
        ├── app-registry       │                                   │
        └── wallet-pnl (pure)  │                             bot-core (FeedState)
                 │             │                             │            │
                 └──────┬──────┘                      Telegram bot   Discord bot
                        │
                 @soltoolkit/mcp  ── stdio ──►  an AI agent
                        │
                    demo API  ── HTTP ──►  anyone
```

## Two kinds of data

**Read on demand.** The TypeScript packages ask an RPC endpoint a question when you call them: quote this trade, grade this token, map these holders, name the app behind this transaction. They need no server of their own. `@soltoolkit/rpc` paces the calls, retries the ones that were throttled, and caps the size of an answer.

**Followed as it happens.** The launch feed follows the launchpad programs and publishes events. A reader keeps the state it wants: `bot-core`'s `FeedState` keeps tokens and five minutes of trades in memory, which is all the bots need.

The two meet in the MCP server and the demo API, which serve the on-demand tools always and the feed's lists when a feed is attached.

## Packages by job

| You want to… | Use |
|---|---|
| Quote or build a launchpad trade for a wallet to sign | [`launchpad-sdk`](https://github.com/robelmit/soltoolkit-sdk/tree/main/packages/launchpad-sdk) |
| Know whether a token is safe to show, and why | [`token-safety`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/token-safety) |
| See who holds a token and which holders act together | [`holder-map`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/holder-map), [`holder-map-react`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/holder-map-react) |
| Know which terminal or bot placed a trade | [`app-registry`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/app-registry) |
| Score a wallet from its trades | [`wallet-pnl`](https://github.com/robelmit/soltoolkit-insights/tree/main/packages/wallet-pnl) |
| Get every launch and trade as it happens | [launch feed](https://github.com/robelmit/soltoolkit-feed) |
| Give a Telegram or Discord community cards and buy posts | [Telegram bot](https://github.com/robelmit/soltoolkit-bots/tree/main/apps/telegram-bot), [Discord bot](https://github.com/robelmit/soltoolkit-bots/tree/main/apps/discord-bot), or build your own on [`bot-core`](https://github.com/robelmit/soltoolkit-bots/tree/main/packages/bot-core) |
| Let an AI agent use any of the above | [`mcp`](../packages/mcp) |
| Serve it over HTTP | [demo API](../apps/demo-api) |

## Rules every piece keeps

- **Unknown is never zero.** A figure that could not be read is `null` or absent, in every type, list and score.
- **Refuse rather than guess.** A missing setting stops a program at start. A read that failed is an error, not "not found".
- **Amounts are exact.** Token amounts are integers in base units, carried as `bigint` in code and as strings in JSON.
- **Outside text is data.** A token's name is escaped wherever it is shown, and never treated as markup or as a mention.
- **Bounded work.** Every walk has a call budget, every list a cap, every sender a rate.

## What is not here

Trading engines, routing, transaction landing, key custody and anything that moves funds are not part of this repository. The SDK builds an unsigned transaction and checks it; a wallet you control signs and sends it.
