import { AppWindowIcon, FingerprintIcon, ListMagnifyingGlassIcon, MagnifyingGlassIcon, QuestionIcon, RobotIcon, TerminalWindowIcon, WalletIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Address } from '@/components/address';
import { DataTable, type Column } from '@/components/data-table';
import { Panel } from '@/components/panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert';
import { Badge } from '@/components/reui/badge';
import { Failure } from '@/components/states';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
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
    <Panel title="Which app placed this trade?" description="Paste a transaction signature. The registry names the terminal, bot or wallet behind it, with the evidence: a fee wallet that was paid, a relayer, or a router program." icon={<FingerprintIcon weight="duotone" />}>
      <div className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex gap-2">
          <InputGroup className="h-10 flex-1">
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Transaction signature" aria-label="Transaction signature" className="font-mono text-sm" spellCheck={false} />
          </InputGroup>
          <Button type="submit" size="lg" className="h-10" disabled={busy}>
            Identify
          </Button>
        </form>
        {busy && <Skeleton className="h-16 w-full" />}
        {error && <Failure message={error} />}
        {result &&
          (result.platform ? (
            <Alert variant="success">
              <AppWindowIcon weight="duotone" />
              <AlertTitle className="flex items-center gap-2">
                {result.platform}
                {result.by && <Badge variant="outline">by {result.by.replace(/_/g, ' ')}</Badge>}
              </AlertTitle>
              <AlertDescription>
                <span className="flex flex-wrap items-center gap-2">
                  Transaction <Address value={result.signature} href={solscan.tx(result.signature)} keep={8} />
                  {result.failed && <Badge variant="destructive-light">failed on chain</Badge>}
                </span>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <QuestionIcon weight="duotone" />
              <AlertTitle>No listed app can be named</AlertTitle>
              <AlertDescription>That is unknown, not "none": the trade may come from an app the registry does not list yet.</AlertDescription>
            </Alert>
          ))}
      </div>
    </Panel>
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
  const columns = useMemo<Column<TradingApp>[]>(
    () => [
      {
        id: 'app',
        header: 'App',
        cell: ({ row }) => {
          const Icon = KIND_ICON[row.original.kind] ?? AppWindowIcon;
          return (
            <span className="flex items-center gap-2 font-medium">
              <Icon weight="duotone" className="size-4 text-muted-foreground" />
              {row.original.name}
              {!row.original.active && (
                <Badge variant="outline" size="sm" className="text-muted-foreground">
                  retired
                </Badge>
              )}
            </span>
          );
        },
      },
      { id: 'kind', header: 'Kind', cell: ({ row }) => <span className="text-muted-foreground capitalize">{row.original.kind}</span> },
      {
        id: 'chains',
        header: 'Chains',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.chains.map((c) => (
              <Badge key={c} variant="secondary">
                {CHAIN_NAME[c] ?? c.toUpperCase()}
              </Badge>
            ))}
          </div>
        ),
      },
    ],
    [],
  );
  return (
    <Panel
      title="The registry"
      description={apps ? `${apps.length} terminals, bots and wallet apps, open and editable as one JSON file.` : 'Terminals, bots and wallet apps the registry can name.'}
      icon={<ListMagnifyingGlassIcon weight="duotone" />}
      flush
    >
      <div className="border-b p-3">
        <InputGroup className="h-9">
          <InputGroupAddon>
            <MagnifyingGlassIcon />
          </InputGroupAddon>
          <InputGroupInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, kind or chain" aria-label="Filter apps" />
        </InputGroup>
      </div>
      {error ? (
        <div className="p-3">
          <Failure message={error} />
        </div>
      ) : (
        <DataTable columns={columns} data={shown} isLoading={apps === null} getRowId={(a) => a.id} pageSize={10} hideOnPhone={['kind']} emptyMessage="No app matches." />
      )}
    </Panel>
  );
}

export function AppsPage({ signature }: { signature: string | null }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Identify signature={signature} />
      <Registry />
    </div>
  );
}
