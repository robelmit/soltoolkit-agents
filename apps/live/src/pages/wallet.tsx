import { CalculatorIcon, ChartLineUpIcon, ClockIcon, CrownIcon, ListBulletsIcon, TrophyIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/data-table';
import { Panel, Stat } from '@/components/panel';
import { Badge } from '@/components/reui/badge';
import { Failure, Figure } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { api, explain, type WalletReport, type WalletTrade } from '@/lib/api';
import { duration, percent, short, usd } from '@/lib/format';

const DAY = 86_400_000;
const start = Date.UTC(2026, 9, 1);
/** Made-up trades, labelled as such on the page, to show what the report reads. */
const SAMPLE: WalletTrade[] = [
  { ts: start, token: 'TokenA1111111111111111111111111111111111111', side: 'buy', amount: 1_000_000, valueUsd: 200 },
  { ts: start + 0.2 * DAY, token: 'TokenA1111111111111111111111111111111111111', side: 'sell', amount: 1_000_000, valueUsd: 540 },
  { ts: start + DAY, token: 'TokenB2222222222222222222222222222222222222', side: 'buy', amount: 50_000, valueUsd: 300 },
  { ts: start + 1.5 * DAY, token: 'TokenB2222222222222222222222222222222222222', side: 'sell', amount: 50_000, valueUsd: 120 },
  { ts: start + 2 * DAY, token: 'TokenC3333333333333333333333333333333333333', side: 'buy', amount: 20_000, valueUsd: 150 },
  { ts: start + 2.1 * DAY, token: 'TokenC3333333333333333333333333333333333333', side: 'sell', amount: 10_000, valueUsd: 260 },
  { ts: start + 3 * DAY, token: 'TokenC3333333333333333333333333333333333333', side: 'sell', amount: 10_000, valueUsd: 310 },
];

type Position = WalletReport['performance']['positions'][number];
const pnlClass = (v: number): string => (v >= 0 ? 'text-success-foreground dark:text-success' : 'text-destructive');

export function WalletPage() {
  const [text, setText] = useState(() => JSON.stringify(SAMPLE, null, 2));
  const [report, setReport] = useState<WalletReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = useMemo<Column<Position>[]>(
    () => [
      { id: 'token', header: 'Token', cell: ({ row }) => <span className="font-mono text-xs">{short(row.original.token, 6)}</span> },
      { id: 'invested', header: 'Invested', cell: ({ row }) => <span className="tabular-nums">{usd(row.original.investedUsd, false)}</span>, meta: { headerClassName: 'text-right', cellClassName: 'text-right' } },
      { id: 'realized', header: 'Realized', cell: ({ row }) => <span className={`font-medium tabular-nums ${pnlClass(row.original.realizedPnlUsd)}`}>{usd(row.original.realizedPnlUsd, false)}</span>, meta: { headerClassName: 'text-right', cellClassName: 'text-right' } },
      {
        id: 'held',
        header: 'Held',
        cell: ({ row }) => (row.original.holdSeconds === null ? <Badge variant="info-light">Still open</Badge> : <span className="text-muted-foreground tabular-nums">{duration(row.original.holdSeconds)}</span>),
        meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      },
    ],
    [],
  );

  const run = async (): Promise<void> => {
    setError(null);
    let trades: unknown;
    try {
      trades = JSON.parse(text);
    } catch {
      setError('The trades are not valid JSON.');
      return;
    }
    if (!Array.isArray(trades)) {
      setError('Give a JSON array of trades.');
      return;
    }
    setBusy(true);
    try {
      setReport(await api<WalletReport>('/v1/wallets/performance', { method: 'POST', body: JSON.stringify({ trades }) }));
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const p = report?.performance;
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Score a wallet" description="Realized profit at average cost, win rate, hold time and a 0–100 score, from the wallet's trades. The trades below are made up to show the format: paste a wallet's own." icon={<CalculatorIcon weight="duotone" />}>
        <div className="flex flex-col gap-3">
          <Label htmlFor="trades" className="text-xs text-muted-foreground">
            Trades: ts (ms), token, side, amount (whole tokens), valueUsd
          </Label>
          <Textarea id="trades" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="h-80 resize-y font-mono text-xs leading-relaxed" />
          {error && <Failure message={error} />}
          <Button size="lg" onClick={() => void run()} disabled={busy}>
            {busy ? <Spinner /> : <ChartLineUpIcon weight="bold" />}
            {busy ? 'Scoring…' : 'Score these trades'}
          </Button>
        </div>
      </Panel>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Realized PnL" value={p ? <Figure value={usd(p.realizedPnlUsd, false)} /> : '—'} icon={<ChartLineUpIcon weight="duotone" />} valueClassName={p ? pnlClass(p.realizedPnlUsd) : undefined} />
          <Stat label="Win rate" value={p ? <Figure value={percent(p.winRate * 100, 0)} /> : '—'} icon={<TrophyIcon weight="duotone" />} />
          <Stat label="Average hold" value={p ? <Figure value={duration(p.avgHoldSeconds)} /> : '—'} icon={<ClockIcon weight="duotone" />} />
          <Stat label="Smart score" value={report ? `${Math.round(report.smartScore)}/100` : '—'} icon={<CrownIcon weight="duotone" />} />
        </div>
        {report && p && (
          <Panel
            title="Positions"
            description={`${p.winCount} won, ${p.lossCount} lost · best ${p.bestMultiple.toFixed(2)}×, worst ${p.worstMultiple.toFixed(2)}× · ${usd(p.totalVolumeUsd)} traded`}
            icon={<ListBulletsIcon weight="duotone" />}
            action={<Progress value={report.smartScore} className="mt-2 w-24" aria-label="Smart score" />}
            flush
          >
            <DataTable columns={columns} data={[...p.positions]} getRowId={(row) => row.token} />
          </Panel>
        )}
      </div>
    </div>
  );
}
