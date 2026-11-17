import { FireIcon, PlugsIcon, RocketLaunchIcon, TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react';
import { useCallback, useState, type ReactNode } from 'react';
import { Address } from '@/components/address';
import { Empty, Failure, Figure } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiError, api, explain, type LaunchToken } from '@/lib/api';
import { ago, count, percent, solscan, usd } from '@/lib/format';
import { go, usePoll } from '@/lib/route';

type State = { tokens: LaunchToken[] | null; error: string | null; noFeed: boolean };

function useList(path: string): State {
  const [state, setState] = useState<State>({ tokens: null, error: null, noFeed: false });
  const load = useCallback(() => {
    api<{ tokens: LaunchToken[] }>(path)
      .then((data) => setState({ tokens: data.tokens, error: null, noFeed: false }))
      .catch((error: unknown) => {
        const noFeed = error instanceof ApiError && (error.code === 'NO_FEED' || error.code === 'NO_ROUTE' || error.status === 404);
        setState((s) => ({ tokens: s.tokens, error: noFeed ? null : explain(error), noFeed }));
      });
  }, [path]);
  // Every 5 seconds while the feed answers; once a minute while it is not connected.
  usePoll(load, state.noFeed ? 60_000 : 5_000);
  return state;
}

function Stage({ token }: { token: LaunchToken }) {
  if (token.stage === 'bonding')
    return (
      <div className="flex min-w-24 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-linear-to-r from-brand to-brand-2" style={{ width: `${Math.min(100, Math.max(2, token.curve ?? 0))}%` }} />
        </div>
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{token.curve === null || token.curve === undefined ? '—' : `${Math.round(token.curve)}%`}</span>
      </div>
    );
  if (token.stage === 'migrated') return <Badge variant="secondary">Migrated</Badge>;
  return <Badge variant="outline">New</Badge>;
}

function Change({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <Figure value={null} />;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${up ? 'text-safe' : 'text-danger'}`}>
      {up ? <TrendUpIcon weight="bold" /> : <TrendDownIcon weight="bold" />}
      {percent(Math.abs(value))}
    </span>
  );
}

function TokenTable({ tokens, trending }: { tokens: LaunchToken[]; trending?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Token</TableHead>
          <TableHead className="hidden sm:table-cell">Launchpad</TableHead>
          <TableHead>{trending ? '5m volume' : 'Stage'}</TableHead>
          <TableHead className="text-right">Market cap</TableHead>
          <TableHead className="hidden text-right md:table-cell">{trending ? '5m change' : 'Holders'}</TableHead>
          <TableHead className="hidden pr-4 text-right lg:table-cell">{trending ? 'Trades' : 'Listed'}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokens.map((token) => (
          <TableRow key={token.address} className="cursor-pointer" onClick={() => go('token', token.address)}>
            <TableCell className="max-w-48 pl-4">
              <div className="truncate font-medium">{token.symbol || 'Unnamed'}</div>
              <Address value={token.address} href={solscan.token(token.address)} className="text-muted-foreground" />
            </TableCell>
            <TableCell className="hidden text-muted-foreground capitalize sm:table-cell">{token.launchpad ?? '—'}</TableCell>
            <TableCell>{trending ? <span className="tabular-nums"><Figure value={usd(token.m5?.volumeUsd)} /></span> : <Stage token={token} />}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              <Figure value={usd(token.mc)} />
            </TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">{trending ? <Change value={token.m5?.priceChangePct} /> : <Figure value={count(token.holders)} />}</TableCell>
            <TableCell className="hidden pr-4 text-right text-muted-foreground tabular-nums lg:table-cell">{trending ? <Figure value={count(token.m5?.trades)} /> : <Figure value={ago(token.createdAt)} />}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ListCard({ title, description, icon, state, trending }: { title: string; description: string; icon: ReactNode; state: State; trending?: boolean }) {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base font-semibold [&_svg]:size-5">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          {state.noFeed ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-muted-foreground/60" />
              Offline
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-safe opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-safe" />
              </span>
              Live
            </span>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {state.error && (
          <div className="p-4">
            <Failure message={state.error} />
          </div>
        )}
        {state.noFeed ? (
          <Empty icon={<PlugsIcon weight="duotone" />} title="The launch feed is not connected to this API">
            The feed is the Rust indexer in soltoolkit-feed. Run it with Redis beside the demo API and this list fills as tokens launch.
          </Empty>
        ) : state.tokens === null ? (
          <div className="flex flex-col gap-3 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : state.tokens.length === 0 ? (
          <Empty icon={<RocketLaunchIcon weight="duotone" />} title="Nothing yet">
            The feed has not seen a token since the API started. New ones appear here within seconds.
          </Empty>
        ) : (
          <TokenTable tokens={state.tokens} trending={trending} />
        )}
      </CardContent>
    </Card>
  );
}

export function LaunchesPage() {
  const latest = useList('/v1/launches?limit=15');
  const trending = useList('/v1/trending?limit=10');
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <ListCard title="New launches" description="pump.fun, PumpSwap, Raydium LaunchLab and Meteora DBC, as they happen." icon={<RocketLaunchIcon weight="duotone" className="text-brand" />} state={latest} />
      <ListCard title="Trending" description="Most traded by dollar volume, last five minutes." icon={<FireIcon weight="duotone" className="text-risky" />} state={trending} trending />
    </div>
  );
}
