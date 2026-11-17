import { ArrowsLeftRightIcon, CheckCircleIcon, CircleDashedIcon, CoinsIcon, GraphIcon, InfoIcon, MagnifyingGlassIcon, ShieldCheckIcon, XCircleIcon } from '@phosphor-icons/react';
import { HolderMap } from '@soltoolkit/holder-map-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Address } from '@/components/address';
import { GradeBadge, gradeInfo } from '@/components/grade';
import { Panel } from '@/components/panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert';
import { Badge } from '@/components/reui/badge';
import { Empty, Failure, Figure } from '@/components/states';
import { TokenSearch } from '@/components/token-search';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ApiError, api, explain, type HolderMapData, type Quote, type Safety, type SafetyCheck } from '@/lib/api';
import { isAddress, percent, short, sol, solscan, units } from '@/lib/format';
import { go } from '@/lib/route';

/** Well-known mainnet tokens to try, by their public mint addresses. */
const EXAMPLES = [
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
];

/** Reads `path`; when the API says it is busy or the budget is spent, waits and asks again, up to three times. */
function useLoad<T>(path: string | null): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: false });
  useEffect(() => {
    if (!path) return;
    let stopped = false;
    setState({ data: null, error: null, loading: true });
    const attempt = async (tries: number): Promise<void> => {
      try {
        const data = await api<T>(path);
        if (!stopped) setState({ data, error: null, loading: false });
      } catch (error) {
        const again = error instanceof ApiError && (error.code === 'BUSY' || error.code === 'RATE_LIMITED') && tries < 3;
        if (again && !stopped) {
          const wait = error.retryAfter ? error.retryAfter * 1000 : 1500 * (tries + 1);
          await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 10_000)));
          if (!stopped) return attempt(tries + 1);
          return;
        }
        if (!stopped) setState({ data: null, error: explain(error), loading: false });
      }
    };
    void attempt(0);
    return () => {
      stopped = true;
    };
  }, [path]);
  return state;
}

function CheckRow({ check }: { check: SafetyCheck }) {
  const icon = check.unverified ? <CircleDashedIcon weight="bold" className="text-muted-foreground" /> : check.passed ? <CheckCircleIcon weight="fill" className="text-success" /> : <XCircleIcon weight="fill" className={check.critical ? 'text-destructive' : 'text-warning'} />;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 [&_svg]:size-5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {check.label}
          {check.critical && !check.passed && !check.unverified && (
            <Badge variant="destructive-light" size="sm">
              critical
            </Badge>
          )}
          {check.unverified && (
            <Badge variant="outline" size="sm" className="text-muted-foreground">
              not verified
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{check.detail}</p>
      </div>
    </li>
  );
}

function SafetyPanel({ safety }: { safety: Safety }) {
  const { report } = safety;
  const info = gradeInfo(report.grade);
  return (
    <Panel title="Safety" description="Read from the chain. A check that could not run never counts as a pass." icon={<ShieldCheckIcon weight="duotone" />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <GradeBadge grade={report.grade} size="xl" />
          <div className="flex flex-col">
            <span className="text-2xl font-semibold tabular-nums">
              {report.score}
              <span className="text-base font-normal text-muted-foreground">/{report.maxScore} passed</span>
            </span>
            <span className="text-xs text-muted-foreground">{info.meaning}</span>
          </div>
        </div>
        <ul className="divide-y">
          {report.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
        {safety.warnings.length > 0 && (
          <Alert variant="warning">
            <InfoIcon weight="duotone" />
            <AlertTitle>Token-2022 features to know about</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {safety.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {report.incomplete && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Progress value={((report.maxScore - report.unverifiedCount) / report.maxScore) * 100} className="w-24" aria-label="Checks that could run" />
            {report.unverifiedCount} of {report.maxScore} checks could not run from the chain alone.
          </div>
        )}
      </div>
    </Panel>
  );
}

function FactsPanel({ safety }: { safety: Safety }) {
  const { facts } = safety;
  const none = <span className="text-success-foreground dark:text-success">None</span>;
  const rows: [string, ReactNode][] = [
    ['Supply', units(facts.supply, facts.decimals, 2)],
    ['Decimals', String(facts.decimals)],
    ['Program', facts.tokenProgram === 'spl-token-2022' ? 'Token-2022' : 'SPL Token'],
    ['Mint authority', facts.mintAuthority ? <Address value={facts.mintAuthority} href={solscan.account(facts.mintAuthority)} /> : none],
    ['Freeze authority', facts.freezeAuthority ? <Address value={facts.freezeAuthority} href={solscan.account(facts.freezeAuthority)} /> : none],
    ['Metadata', facts.metadata ? (facts.metadata.mutable ? 'Can still be changed' : 'Locked') : <Figure value={null} />],
    ['Top 10 holders', facts.holders ? `${percent(facts.holders.top10Pct)}${facts.holders.complete ? '' : ' or more'}` : <Figure value={null} />],
  ];
  return (
    <Panel title="On-chain facts" icon={<InfoIcon weight="duotone" />}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {safety.notes.length > 0 && <p className="mt-4 text-xs text-muted-foreground">{safety.notes.join(' ')}</p>}
    </Panel>
  );
}

const BUYS = [
  { label: '0.1 SOL', lamports: '100000000' },
  { label: '0.5 SOL', lamports: '500000000' },
  { label: '1 SOL', lamports: '1000000000' },
  { label: '5 SOL', lamports: '5000000000' },
];

function QuotePanel({ mint, decimals, symbol }: { mint: string; decimals: number | null; symbol: string }) {
  const [amount, setAmount] = useState(BUYS[0]!.lamports);
  const quote = useLoad<Quote>(`/v1/quote?mint=${mint}&side=buy&amountIn=${amount}&slippageBps=300`);
  const out = (raw: string): string => (decimals === null ? `${raw} raw units` : `${units(raw, decimals, 2)} ${symbol}`);
  return (
    <Panel title="Quote a buy" description="On pump.fun, PumpSwap or Meteora DBC, whichever holds it, in the venue's own arithmetic." icon={<ArrowsLeftRightIcon weight="duotone" />}>
      <div className="flex flex-col gap-4">
        <ToggleGroup type="single" variant="outline" value={amount} onValueChange={(v) => v && setAmount(v)} className="w-full">
          {BUYS.map((b) => (
            <ToggleGroupItem key={b.lamports} value={b.lamports} className="flex-1">
              {b.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {quote.loading ? (
          <div className="grid gap-2">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : quote.error ? (
          <p className="text-sm text-muted-foreground">{quote.error.includes('None of the supported launchpads') ? 'This token does not trade on pump.fun, PumpSwap or Meteora DBC, so there is nothing to quote here.' : quote.error}</p>
        ) : quote.data ? (
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-xs text-muted-foreground">You would get about</span>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{out(quote.data.outAmount)}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Venue</dt>
              <dd className="text-right">
                <Badge variant="primary-light" className="capitalize">
                  {quote.data.venue}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">At least, with 3% slippage</dt>
              <dd className="text-right tabular-nums">{out(quote.data.minOutAmount)}</dd>
              <dt className="text-muted-foreground">Venue fee</dt>
              <dd className="text-right tabular-nums">{sol(quote.data.venueFeeLamports)} SOL</dd>
              <dt className="text-muted-foreground">Price impact</dt>
              <dd className="text-right tabular-nums">
                <Figure value={quote.data.priceImpactBps === null ? null : percent(quote.data.priceImpactBps / 100, 2)} />
              </dd>
            </dl>
            <p className="text-xs text-muted-foreground">A quote only. The SDK builds the unsigned transaction for your own wallet and verifies it before anything is signed.</p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/** The heaviest read: started only once the safety report is in, so it does not crowd the others out. */
function HoldersPanel({ mint, ready }: { mint: string; ready: boolean }) {
  const map = useLoad<HolderMapData>(ready ? `/v1/tokens/${mint}/holders?walk=10` : null);
  const graph = useMemo(() => (map.data ? { nodes: map.data.nodes, edges: map.data.edges, clusters: map.data.clusters } : null), [map.data]);
  const clusters = map.data?.clusters ?? [];
  return (
    <Panel
      title="Holder map"
      description="The largest holders, the transfers among them, and the clusters they form. Pools and burn addresses stay out of clusters."
      icon={<GraphIcon weight="duotone" />}
      action={clusters.length > 0 ? <Badge variant="info-light">{clusters.length} clusters</Badge> : undefined}
    >
      {map.loading || !ready ? (
        <div className="grid place-items-center gap-3 py-16 text-sm text-muted-foreground">
          <Spinner className="size-6" />
          Reading holders and their transfers from the chain…
        </div>
      ) : map.error ? (
        <Failure message={map.error} />
      ) : graph && map.data ? (
        <div className="flex flex-col gap-3">
          {clusters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {clusters.slice(0, 4).map((c) => (
                <Badge key={c.id} variant="outline" className="tabular-nums">
                  Cluster {c.id}: {c.wallets} wallets, {percent(c.pct)}
                </Badge>
              ))}
            </div>
          )}
          <HolderMap graph={graph} notes={map.data.notes} theme="auto" width={760} height={460} />
        </div>
      ) : null}
    </Panel>
  );
}

export function TokenPage({ mint }: { mint: string | null }) {
  const valid = mint !== null && isAddress(mint);
  const safety = useLoad<Safety>(valid ? `/v1/tokens/${mint}/safety` : null);
  if (!valid)
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Check any Solana token</h1>
          <p className="mt-1 text-muted-foreground">Safety grade, on-chain facts, holder clusters and a live quote, read from mainnet.</p>
        </div>
        <TokenSearch autoFocus />
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          Try
          {EXAMPLES.map((e) => (
            <Button key={e.mint} variant="outline" size="sm" onClick={() => go('token', e.mint)}>
              <CoinsIcon weight="duotone" />
              {e.symbol}
            </Button>
          ))}
          or a token from the launches page.
        </div>
      </div>
    );

  const meta = safety.data?.facts.metadata;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {safety.loading ? (
            <Skeleton className="h-8 w-56" />
          ) : (
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
              {meta ? meta.name : short(mint, 6)}
              {meta?.symbol && meta.symbol.toLowerCase() !== meta.name.toLowerCase() && <span className="text-lg font-normal text-muted-foreground">{meta.symbol}</span>}
              {safety.data && <GradeBadge grade={safety.data.report.grade} />}
            </h1>
          )}
          <Address value={mint} href={solscan.token(mint)} keep={8} className="mt-1 text-muted-foreground" />
        </div>
        <div className="w-full md:max-w-md">
          <TokenSearch />
        </div>
      </div>
      {safety.error ? (
        <Panel title="Could not read this token" icon={<MagnifyingGlassIcon weight="duotone" />}>
          <Empty icon={<MagnifyingGlassIcon weight="duotone" />} title="Nothing came back from the chain">
            {safety.error}
          </Empty>
        </Panel>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            {safety.data ? <SafetyPanel safety={safety.data} /> : <Skeleton className="h-96 rounded-xl" />}
            <div className="flex flex-col gap-6">
              {safety.data ? <FactsPanel safety={safety.data} /> : <Skeleton className="h-64 rounded-xl" />}
              <QuotePanel mint={mint} decimals={safety.data?.facts.decimals ?? null} symbol={meta?.symbol ?? 'tokens'} />
            </div>
          </div>
          <HoldersPanel mint={mint} ready={safety.data !== null} />
        </>
      )}
    </div>
  );
}
