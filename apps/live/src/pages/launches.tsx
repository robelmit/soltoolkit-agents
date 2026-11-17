import { FireIcon, PlugsIcon, RocketLaunchIcon, TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Address } from '@/components/address';
import { DataTable, type Column } from '@/components/data-table';
import { Panel } from '@/components/panel';
import { Badge } from '@/components/reui/badge';
import { Empty, Failure, Figure } from '@/components/states';
import { Progress } from '@/components/ui/progress';
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
      <div className="flex min-w-28 items-center gap-2">
        <Progress value={Math.min(100, Math.max(2, token.curve ?? 0))} className="h-1.5 flex-1" aria-label="Bonding curve progress" />
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{token.curve === null || token.curve === undefined ? '—' : `${Math.round(token.curve)}%`}</span>
      </div>
    );
  if (token.stage === 'migrated') return <Badge variant="success-light">Migrated</Badge>;
  return <Badge variant="info-light">New</Badge>;
}

function Change({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <Figure value={null} />;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${up ? 'text-success-foreground dark:text-success' : 'text-destructive'}`}>
      {up ? <TrendUpIcon weight="bold" /> : <TrendDownIcon weight="bold" />}
      {percent(Math.abs(value))}
    </span>
  );
}

function useColumns(trending: boolean): Column<LaunchToken>[] {
  return useMemo<Column<LaunchToken>[]>(
    () => [
      {
        id: 'token',
        header: 'Token',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.symbol || 'Unnamed'}</div>
            <Address value={row.original.address} href={solscan.token(row.original.address)} className="text-muted-foreground" />
          </div>
        ),
      },
      { id: 'launchpad', header: 'Launchpad', cell: ({ row }) => <span className="text-muted-foreground capitalize">{row.original.launchpad ?? '—'}</span> },
      trending
        ? { id: 'volume', header: '5m volume', cell: ({ row }) => <span className="tabular-nums"><Figure value={usd(row.original.m5?.volumeUsd)} /></span> }
        : { id: 'stage', header: 'Stage', cell: ({ row }) => <Stage token={row.original} /> },
      { id: 'mc', header: 'Market cap', cell: ({ row }) => <span className="font-medium tabular-nums"><Figure value={usd(row.original.mc)} /></span>, meta: { headerClassName: 'text-right', cellClassName: 'text-right' } },
      trending
        ? { id: 'change', header: '5m change', cell: ({ row }) => <Change value={row.original.m5?.priceChangePct} />, meta: { headerClassName: 'text-right', cellClassName: 'text-right' } }
        : { id: 'holders', header: 'Holders', cell: ({ row }) => <span className="tabular-nums"><Figure value={count(row.original.holders)} /></span>, meta: { headerClassName: 'text-right', cellClassName: 'text-right' } },
      trending
        ? { id: 'trades', header: 'Trades', cell: ({ row }) => <span className="text-muted-foreground tabular-nums"><Figure value={count(row.original.m5?.trades)} /></span>, meta: { headerClassName: 'text-right', cellClassName: 'text-right' } }
        : { id: 'listed', header: 'Listed', cell: ({ row }) => <span className="text-muted-foreground tabular-nums"><Figure value={ago(row.original.createdAt)} /></span>, meta: { headerClassName: 'text-right', cellClassName: 'text-right' } },
    ],
    [trending],
  );
}

function ListPanel({ title, description, icon, state, trending = false }: { title: string; description: string; icon: ReactNode; state: State; trending?: boolean }) {
  const columns = useColumns(trending);
  const status = state.noFeed ? (
    <Badge variant="secondary" radius="full">
      Offline
    </Badge>
  ) : (
    <Badge variant="success-light" radius="full">
      <span className="size-1.5 animate-pulse rounded-full bg-success" />
      Live
    </Badge>
  );
  return (
    <Panel title={title} description={description} icon={icon} action={status} flush>
      {state.error && (
        <div className="p-3">
          <Failure message={state.error} />
        </div>
      )}
      {state.noFeed ? (
        <Empty icon={<PlugsIcon weight="duotone" />} title="The launch feed is not connected to this API">
          The feed is the Rust indexer in soltoolkit-feed. Run it with Redis beside the demo API and this list fills as tokens launch.
        </Empty>
      ) : (
        <DataTable
          columns={columns}
          data={state.tokens ?? []}
          isLoading={state.tokens === null}
          getRowId={(t) => t.address}
          onRowClick={(t) => go('token', t.address)}
          hideOnPhone={['launchpad', trending ? 'change' : 'holders', trending ? 'trades' : 'listed']}
          emptyMessage="The feed has not seen a token since the API started. New ones appear here within seconds."
        />
      )}
    </Panel>
  );
}

export function LaunchesPage() {
  const latest = useList('/v1/launches?limit=15');
  const trending = useList('/v1/trending?limit=10');
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <ListPanel title="New launches" description="pump.fun, PumpSwap, Raydium LaunchLab and Meteora DBC, as they happen." icon={<RocketLaunchIcon weight="duotone" />} state={latest} />
      <ListPanel title="Trending" description="Most traded by dollar volume, last five minutes." icon={<FireIcon weight="duotone" />} state={trending} trending />
    </div>
  );
}
