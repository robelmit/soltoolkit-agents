import { AppWindowIcon, FingerprintIcon, MagnifyingGlassIcon, QuestionIcon, RobotIcon, TerminalWindowIcon, WalletIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Address } from '@/components/address';
import { Empty, Failure } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, explain, type AppAttribution, type TradingApp } from '@/lib/api';
import { isSignature, solscan } from '@/lib/format';
import { go } from '@/lib/route';

const KIND_ICON: Record<string, typeof RobotIcon> = { terminal: TerminalWindowIcon, bot: RobotIcon, wallet: WalletIcon };
const CHAIN_NAME: Record<string, string> = { sol: 'Solana', eth: 'Ethereum', base: 'Base', bsc: 'BNB Chain', hood: 'Robinhood', arc: 'Arc', arb: 'Arbitrum' };

function Identify({ signature }: { signature: string | null }) {
  const [text, setText] = useState(signature ?? '');
  const [result, setResult] = useState<AppAttribution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const look = useCallback(async (sig: string) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api<AppAttribution>(`/v1/transactions/${sig}/app`));
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (signature && isSignature(signature)) {
      setText(signature);
      void look(signature);
    }
  }, [signature, look]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!isSignature(text)) {
      setError('That is not a Solana transaction signature.');
      return;
    }
    go('apps', text.trim());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <FingerprintIcon weight="duotone" className="size-5 text-brand" />
          Which app placed this trade?
        </CardTitle>
        <CardDescription>Paste a transaction signature. The registry names the terminal, bot or wallet behind it, with the evidence: a fee wallet that was paid, a relayer, or a router program.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Transaction signature" aria-label="Transaction signature" className="h-10 pl-9 font-mono text-sm" spellCheck={false} />
          </div>
          <Button type="submit" size="lg" className="h-10" disabled={busy}>
            Identify
          </Button>
        </form>
        {busy && <Skeleton className="h-16 w-full" />}
        {error && <Failure message={error} />}
        {result && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
            {result.platform ? (
              <p className="flex items-center gap-2 text-lg font-semibold">
                <AppWindowIcon weight="duotone" className="size-6 text-brand" />
                {result.platform}
                {result.by && <Badge variant="outline">by {result.by.replace(/_/g, ' ')}</Badge>}
              </p>
            ) : (
              <p className="flex items-center gap-2 font-medium">
                <QuestionIcon weight="duotone" className="size-5 text-muted-foreground" />
                No listed app can be named. That is unknown, not "none".
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Transaction <Address value={result.signature} href={solscan.tx(result.signature)} keep={8} />
              {result.failed && <Badge className="bg-danger/12 text-danger">failed on chain</Badge>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Registry() {
  const [apps, setApps] = useState<TradingApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    api<{ apps: TradingApp[] }>('/v1/apps')
      .then((d) => setApps(d.apps))
      .catch((e: unknown) => setError(explain(e)));
  }, []);
  const shown = useMemo(() => (apps ?? []).filter((a) => `${a.name} ${a.kind} ${a.chains.map((c) => `${c} ${CHAIN_NAME[c] ?? ''}`).join(' ')}`.toLowerCase().includes(filter.toLowerCase())), [apps, filter]);
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">The registry</CardTitle>
        <CardDescription>{apps ? `${apps.length} terminals, bots and wallet apps, open and editable as one JSON file.` : 'Terminals, bots and wallet apps the registry can name.'}</CardDescription>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" aria-label="Filter apps" className="mt-2 h-8" />
      </CardHeader>
      <CardContent className="max-h-[32rem] overflow-y-auto px-0">
        {error ? (
          <div className="p-4">
            <Failure message={error} />
          </div>
        ) : !apps ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <Empty icon={<MagnifyingGlassIcon weight="duotone" />} title="No app matches" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">App</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="pr-4">Chains</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((app) => {
                const Icon = KIND_ICON[app.kind] ?? AppWindowIcon;
                return (
                  <TableRow key={app.id}>
                    <TableCell className="pl-4 font-medium">
                      <span className="flex items-center gap-2">
                        <Icon weight="duotone" className="size-4 text-muted-foreground" />
                        {app.name}
                        {!app.active && <Badge variant="outline" className="text-muted-foreground">retired</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">{app.kind}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex flex-wrap gap-1">
                        {app.chains.map((c) => (
                          <Badge key={c} variant="secondary">
                            {CHAIN_NAME[c] ?? c.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function AppsPage({ signature }: { signature: string | null }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Identify signature={signature} />
      <Registry />
    </div>
  );
}
