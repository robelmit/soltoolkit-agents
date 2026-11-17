import { CalculatorIcon, ChartLineUpIcon, ClockIcon, CrownIcon, TrophyIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { Failure, Figure } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

function Stat({ label, value, icon, tone }: { label: string; value: ReactNode; icon: ReactNode; tone?: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={`text-2xl font-semibold tracking-tight tabular-nums ${tone ?? ''}`}>{value}</span>
        </div>
        <div className="grid size-9 place-items-center rounded-lg bg-brand/10 text-brand [&_svg]:size-5">{icon}</div>
      </CardContent>
    </Card>
  );
}

export function WalletPage() {
  const [text, setText] = useState(() => JSON.stringify(SAMPLE, null, 2));
  const [report, setReport] = useState<WalletReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  const pnlTone = p ? (p.realizedPnlUsd >= 0 ? 'text-safe' : 'text-danger') : '';
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CalculatorIcon weight="duotone" className="size-5 text-brand" />
            Score a wallet
          </CardTitle>
          <CardDescription>Realized profit at average cost, win rate, hold time and a 0–100 score, from the wallet's trades. The trades below are made up to show the format: paste a wallet's own.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Label htmlFor="trades" className="text-xs text-muted-foreground">
            Trades: ts (ms), token, side, amount (whole tokens), valueUsd
          </Label>
          <textarea id="trades" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="h-80 w-full resize-y rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
          {error && <Failure message={error} />}
          <Button size="lg" onClick={() => void run()} disabled={busy}>
            <ChartLineUpIcon weight="bold" />
            {busy ? 'Scoring…' : 'Score these trades'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Realized PnL" value={p ? <Figure value={usd(p.realizedPnlUsd, false)} /> : '—'} icon={<ChartLineUpIcon weight="duotone" />} tone={pnlTone} />
          <Stat label="Win rate" value={p ? <Figure value={percent(p.winRate * 100, 0)} /> : '—'} icon={<TrophyIcon weight="duotone" />} />
          <Stat label="Average hold" value={p ? <Figure value={duration(p.avgHoldSeconds)} /> : '—'} icon={<ClockIcon weight="duotone" />} />
          <Stat label="Smart score" value={report ? `${Math.round(report.smartScore)}/100` : '—'} icon={<CrownIcon weight="duotone" />} />
        </div>
        {report && p && (
          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Positions</CardTitle>
              <CardDescription>
                {p.winCount} won, {p.lossCount} lost · best {p.bestMultiple.toFixed(2)}×, worst {p.worstMultiple.toFixed(2)}× · {usd(p.totalVolumeUsd)} traded
              </CardDescription>
              <Progress value={report.smartScore} className="mt-2" aria-label="Smart score" />
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Token</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Realized</TableHead>
                    <TableHead className="pr-4 text-right">Held</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.positions.map((pos) => (
                    <TableRow key={pos.token}>
                      <TableCell className="pl-4 font-mono text-xs">{short(pos.token, 6)}</TableCell>
                      <TableCell className="text-right tabular-nums">{usd(pos.investedUsd, false)}</TableCell>
                      <TableCell className={`text-right font-medium tabular-nums ${pos.realizedPnlUsd >= 0 ? 'text-safe' : 'text-danger'}`}>{usd(pos.realizedPnlUsd, false)}</TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground tabular-nums">{pos.holdSeconds === null ? 'Still open' : duration(pos.holdSeconds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
