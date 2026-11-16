/**
 * The tools. Every one of them reads; none signs, sends or moves anything.
 *
 * Each tool is a thin call into one of the packages of this repository, with
 * bounds set here so that one call cannot run up an unbounded number of RPC
 * reads: a holder map walks at most `maxHolderWalk` holders within
 * `maxCallsPerTool` calls, and a trade list is capped.
 */

import { BUILT_IN_PLATFORMS, attributePlatform, platformLabel, solanaTxFacts } from '@soltoolkit/app-registry';
import { HoldersUnavailable, buildHolderMap } from '@soltoolkit/holder-map';
import { LaunchpadError, NoVenueError, type Launchpads } from '@soltoolkit/launchpad-sdk';
import type { Rpc } from '@soltoolkit/rpc';
import { checkToken } from '@soltoolkit/token-safety';
import { computeSmartScore, computeWalletPerformance, type WalletTrade } from '@soltoolkit/wallet-pnl';
import { ADDRESS_PATTERN, SIGNATURE_PATTERN, UNITS_PATTERN, type ObjectSchema } from './schema';

/** Tokens from a launch feed, when the server was given one. `FeedState` of `@soltoolkit/bot-core` fits. */
export interface LaunchSource {
  latest(limit: number): Promise<readonly unknown[]>;
  trending(limit: number): Promise<readonly unknown[]>;
}

export interface ToolContext {
  readonly rpc: Rpc;
  readonly launchpads: Launchpads;
  readonly feed: LaunchSource | null;
  readonly limits: ToolLimits;
}

export interface ToolLimits {
  /** Holders whose transactions a holder map reads, at most. */
  readonly maxHolderWalk: number;
  /** RPC calls one holder map may make. */
  readonly maxCallsPerTool: number;
}

export const DEFAULT_TOOL_LIMITS: ToolLimits = Object.freeze({ maxHolderWalk: 20, maxCallsPerTool: 150 });

/** A tool could not do the thing, for a reason the caller can act on. Returned as a tool error, not a protocol error. */
export class ToolFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ToolFailure';
  }
}

export interface Tool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: ObjectSchema;
  /** Listed only when the server has a launch feed. */
  readonly needsFeed?: boolean;
  run(args: Record<string, unknown>, context: ToolContext): Promise<unknown>;
}

const MINT = { type: 'string', description: 'The token mint address (base58).', pattern: ADDRESS_PATTERN } as const;
/** The address a quote is computed for when the caller names no wallet: Solana's incinerator, which nobody can sign for. */
const NO_WALLET = '1nc1nerator11111111111111111111111111111111';

const object = (properties: ObjectSchema['properties'], required: readonly string[] = []): ObjectSchema => ({ type: 'object', properties, required, additionalProperties: false });

export const TOOLS: readonly Tool[] = [
  {
    name: 'launchpad_quote',
    title: 'Quote a launchpad trade',
    description:
      'Quotes a buy or a sell of a token on pump.fun, PumpSwap or Meteora DBC, whichever holds it. Amounts are whole numbers of base units as strings: lamports in for a buy, raw token units in for a sell. Returns the venue, the expected output, the least output at the given slippage, the venue fee and the price impact (null when the venue does not give one). It only quotes: no transaction is built, signed or sent.',
    input: object(
      {
        mint: MINT,
        side: { type: 'string', description: 'buy (SOL in) or sell (tokens in).', enum: ['buy', 'sell'] },
        amountIn: { type: 'string', description: 'Base units of the input: lamports for a buy, raw token units for a sell.', pattern: UNITS_PATTERN },
        slippageBps: { type: 'integer', description: 'Slippage tolerance in basis points (100 = 1 %). Default 300.', minimum: 1, maximum: 5000 },
        wallet: { type: 'string', description: 'The wallet the quote is for. Optional; a quote does not depend on it for most venues.', pattern: ADDRESS_PATTERN },
      },
      ['mint', 'side', 'amountIn'],
    ),
    async run(args, { launchpads }) {
      try {
        const quote = await launchpads.quote({ side: args.side as 'buy' | 'sell', mint: args.mint as string, amountIn: BigInt(args.amountIn as string), slippageBps: (args.slippageBps as number | undefined) ?? 300, user: (args.wallet as string | undefined) ?? NO_WALLET });
        return {
          venue: quote.venue,
          side: quote.side,
          mint: quote.mint,
          inAmount: quote.inAmount.toString(),
          outAmount: quote.outAmount.toString(),
          minOutAmount: quote.minOutAmount.toString(),
          slippageBps: quote.slippageBps,
          venueFeeLamports: quote.venueFeeLamports.toString(),
          priceImpactBps: quote.priceImpactBps,
          quotedAt: quote.quotedAt,
          units: quote.side === 'buy' ? { in: 'lamports', out: 'raw token units' } : { in: 'raw token units', out: 'lamports' },
        };
      } catch (error) {
        if (error instanceof NoVenueError) throw new ToolFailure('NO_VENUE', 'None of the supported launchpads has this token.', { attempts: error.attempts.map((a) => ({ venue: a.venue, code: a.code })) });
        if (error instanceof LaunchpadError) throw new ToolFailure(error.code, error.message.startsWith(`${error.venue}:`) ? error.message : `${error.venue}: ${error.message}`);
        throw error;
      }
    },
  },
  {
    name: 'token_safety',
    title: 'Grade a token',
    description:
      'Reads a token from the chain and grades it. The checks that can run from the chain alone are mint authority, freeze authority, metadata mutability, top-10 holder share and, when the creator is given, developer share; Token-2022 extensions that let someone else act on the tokens are listed as warnings. A check that could not be run is reported as not verified and never counts as a pass, and a token with too little known is graded "unknown", which is not "safe".',
    input: object({ mint: MINT, creator: { type: 'string', description: 'The wallet that created the token; with it the developer-share check runs.', pattern: ADDRESS_PATTERN } }, ['mint']),
    async run(args, { rpc }) {
      const check = await checkToken({ rpc, mint: args.mint as string, ...(args.creator ? { creator: args.creator as string } : {}) });
      if (!check) throw new ToolFailure('NOT_A_TOKEN', 'That address is not a token mint.');
      return { mint: args.mint, report: check.report, warnings: check.warnings, notes: check.notes, facts: check.facts };
    },
  },
  {
    name: 'holder_map',
    title: 'Map a token\'s holders',
    description:
      'Reads the largest holders of a token and the transfers among them, and groups connected holders into clusters. Pools, burn addresses and programs are marked and kept out of clusters. Returns nodes (address, share in percent or null when unknown, type, cluster), edges, clusters, and notes that say what the map covers and what it does not. A widely held token may be refused by the RPC endpoint; the error says so.',
    input: object({ mint: MINT, walk: { type: 'integer', description: 'How many holders\' transactions are read for transfers, largest first. Default 10. 0 reads none.', minimum: 0, maximum: 50 } }, ['mint']),
    async run(args, { rpc, limits }) {
      const walk = Math.min((args.walk as number | undefined) ?? 10, limits.maxHolderWalk);
      try {
        const map = await buildHolderMap(rpc, args.mint as string, { walk, links: { maxCalls: limits.maxCallsPerTool } });
        if (!map) throw new ToolFailure('NOT_A_TOKEN', 'That address is not a token mint.');
        return { mint: map.mint, nodes: map.graph.nodes, edges: map.graph.edges, clusters: map.graph.clusters, notes: map.notes, walked: walk };
      } catch (error) {
        if (error instanceof HoldersUnavailable) throw new ToolFailure('HOLDERS_UNAVAILABLE', error.message);
        throw error;
      }
    },
  },
  {
    name: 'identify_trading_app',
    title: 'Name the app behind a trade',
    description:
      'Reads one Solana transaction and says which terminal, bot or wallet app placed it (Axiom, Photon, Trojan and others), with the evidence that decided: a fee wallet that was credited, a relayer that paid the fee, or a router program. Returns platform null when no listed app can be named; that is "unknown", not "none".',
    input: object({ signature: { type: 'string', description: 'The transaction signature (base58).', pattern: SIGNATURE_PATTERN } }, ['signature']),
    async run(args, { rpc }) {
      const result = await rpc.call('getTransaction', [args.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1, commitment: 'confirmed' }]);
      if (result === null || result === undefined) throw new ToolFailure('NOT_FOUND', 'The endpoint does not have that transaction. It may be too old for this endpoint, or not confirmed yet.');
      const facts = solanaTxFacts(result);
      if (!facts) throw new ToolFailure('UNREADABLE', 'The transaction came back in a shape that cannot be read.');
      const hit = attributePlatform(facts);
      return { signature: args.signature, failed: facts.failed, platform: hit ? platformLabel(hit.platform) : null, by: hit?.by ?? null, evidence: hit?.evidence ?? null };
    },
  },
  {
    name: 'list_trading_apps',
    title: 'List the known trading apps',
    description: 'Lists the terminals, bots and wallet apps the registry can name, with their kind and the chains they trade on. Addresses are left out; identify_trading_app applies them.',
    input: object({}),
    async run() {
      return { apps: BUILT_IN_PLATFORMS.platforms.map((p) => ({ id: p.id, name: p.name, kind: p.kind, chains: p.chains, active: p.active !== false })) };
    },
  },
  {
    name: 'wallet_performance',
    title: 'Score a wallet from its trades',
    description:
      'Computes realized profit and loss at average cost, win rate, hold time and a 0-100 smart-money score from a list of trades you supply. It reads nothing from the chain: the result is exactly as complete as the list. A sale with no recorded buy adds no profit.',
    input: object(
      {
        trades: {
          type: 'array',
          description: 'The wallet\'s trades, in any order.',
          maxItems: 5000,
          items: object(
            {
              ts: { type: 'number', description: 'When it happened, in milliseconds since the epoch.', minimum: 0 },
              token: { type: 'string', description: 'The token mint.', maxLength: 64 },
              side: { type: 'string', description: 'buy or sell.', enum: ['buy', 'sell'] },
              amount: { type: 'number', description: 'Token quantity in whole tokens.', minimum: 0 },
              valueUsd: { type: 'number', description: 'US dollar value of the whole trade.', minimum: 0 },
            },
            ['ts', 'token', 'side', 'amount', 'valueUsd'],
          ),
        },
        since: { type: 'number', description: 'Count only trades at or after this time (ms); earlier trades still set the cost basis.', minimum: 0 },
      },
      ['trades'],
    ),
    async run(args) {
      const trades = args.trades as WalletTrade[];
      const performance = computeWalletPerformance(trades, args.since !== undefined ? { since: args.since as number } : {});
      return { trades: trades.length, performance, smartScore: computeSmartScore(performance) };
    },
  },
  {
    name: 'latest_launches',
    title: 'The newest launchpad tokens',
    description: 'The newest tokens the launch feed has listed since this server started, newest first, with stage, curve progress, price and market cap. Figures the feed does not know are null.',
    input: object({ limit: { type: 'integer', description: 'How many, at most. Default 10.', minimum: 1, maximum: 50 } }),
    needsFeed: true,
    async run(args, { feed }) {
      if (!feed) throw new ToolFailure('NO_FEED', 'This server has no launch feed.');
      return { tokens: await feed.latest((args.limit as number | undefined) ?? 10) };
    },
  },
  {
    name: 'trending_tokens',
    title: 'The most traded launchpad tokens',
    description: 'The launchpad tokens with the highest dollar volume over the last five minutes, as seen by the launch feed. Tokens whose trades have no dollar value are left out, not counted as zero.',
    input: object({ limit: { type: 'integer', description: 'How many, at most. Default 10.', minimum: 1, maximum: 50 } }),
    needsFeed: true,
    async run(args, { feed }) {
      if (!feed) throw new ToolFailure('NO_FEED', 'This server has no launch feed.');
      return { tokens: await feed.trending((args.limit as number | undefined) ?? 10) };
    },
  },
];
