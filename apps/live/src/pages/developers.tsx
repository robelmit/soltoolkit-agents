import { ArrowSquareOutIcon, BracketsCurlyIcon, CubeIcon, GithubLogoIcon, PackageIcon, PlugsConnectedIcon, RobotIcon } from '@phosphor-icons/react';
import { CopyButton } from '@/components/address';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE } from '@/lib/api';

const REPOS = [
  { name: 'soltoolkit-sdk', what: 'Launchpad trade SDK: quote, build the unsigned transaction, verify it. The paced RPC client.' },
  { name: 'soltoolkit-feed', what: 'The launch feed in Rust: launches, trades, curve progress and migrations as one event stream.' },
  { name: 'soltoolkit-insights', what: 'Token safety, holder maps and their React viewer, wallet PnL, the trading-app registry.' },
  { name: 'soltoolkit-bots', what: 'Self-hosted Telegram and Discord bots: token cards, trending, a buy bot.' },
  { name: 'soltoolkit-agents', what: 'The read-only MCP server for AI agents, this demo API, and this site.' },
];

const PACKAGES = ['launchpad-sdk', 'rpc', 'token-safety', 'holder-map', 'holder-map-react', 'wallet-pnl', 'app-registry', 'bot-core', 'mcp'];

const ROUTES = [
  ['GET', '/v1/quote?mint=…&side=buy&amountIn=100000000', 'Quote on pump.fun, PumpSwap or Meteora DBC'],
  ['GET', '/v1/tokens/{mint}/safety', 'Graded safety report'],
  ['GET', '/v1/tokens/{mint}/holders', 'Holder map with clusters'],
  ['GET', '/v1/transactions/{signature}/app', 'The app that placed a trade'],
  ['GET', '/v1/apps', 'The trading-app registry'],
  ['GET', '/v1/launches', 'Newest launchpad tokens'],
  ['GET', '/v1/trending', 'Most traded, last five minutes'],
  ['POST', '/v1/wallets/performance', 'PnL, win rate and score from trades'],
  ['POST', '/mcp', 'The same tools over the Model Context Protocol'],
];

function Code({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/50 py-2 pr-1.5 pl-3">
      <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre">{text}</pre>
      <CopyButton text={text} />
    </div>
  );
}

export function DevelopersPage() {
  const origin = API_BASE || window.location.origin;
  const mcpConfig = JSON.stringify({ mcpServers: { soltoolkit: { command: 'npx', args: ['-y', '@soltoolkit/mcp'], env: { SOLANA_RPC_URL: 'https://your-rpc.example' } } } }, null, 2);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build with soltoolkit</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">Everything on this site is open source under the MIT licence, runs on a Solana RPC endpoint you choose, and never holds a key.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PackageIcon weight="duotone" className="size-5 text-brand" />
              Install from npm
            </CardTitle>
            <CardDescription>Nine packages, each usable on its own. ESM and CommonJS, typed, Node 20 or later.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Code text="npm i @soltoolkit/launchpad-sdk @soltoolkit/token-safety" />
            <div className="flex flex-wrap gap-1.5">
              {PACKAGES.map((p) => (
                <Badge key={p} variant="secondary" className="font-mono">
                  @soltoolkit/{p}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <RobotIcon weight="duotone" className="size-5 text-brand" />
              Give an AI agent the tools
            </CardTitle>
            <CardDescription>A read-only MCP server: quote, grade a token, map holders, name the app behind a trade. No tool signs or sends.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code text={mcpConfig} />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <PlugsConnectedIcon weight="duotone" className="size-5 text-brand" />
            The free API behind this site
          </CardTitle>
          <CardDescription>
            JSON over HTTP, a small budget per client, cross-origin allowed. Base URL <span className="font-mono">{origin}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y">
            {ROUTES.map(([method, path, what]) => (
              <li key={path} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <Badge variant={method === 'GET' ? 'secondary' : 'outline'} className="w-12 justify-center font-mono">
                  {method}
                </Badge>
                <span className="font-mono text-xs break-all">{path}</span>
                <span className="text-sm text-muted-foreground sm:ml-auto">{what}</span>
              </li>
            ))}
          </ul>
          <div className="border-t p-4">
            <Code text={`curl ${origin}/v1/tokens/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/safety`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <GithubLogoIcon weight="duotone" className="size-5 text-brand" />
            Source
          </CardTitle>
          <CardDescription>Five repositories, so each piece can be used, forked and contributed to on its own.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPOS.map((r) => (
            <a key={r.name} href={`https://github.com/robelmit/${r.name}`} target="_blank" rel="noreferrer" className="group flex flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-muted/60">
              <span className="flex items-center gap-2 font-mono text-sm font-medium">
                <CubeIcon weight="duotone" className="size-4 text-brand" />
                {r.name}
                <ArrowSquareOutIcon className="ml-auto size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="text-xs text-muted-foreground">{r.what}</span>
            </a>
          ))}
          <Button variant="outline" asChild className="h-auto justify-start p-3">
            <a href="https://github.com/robelmit/soltoolkit-agents/tree/main/apps/demo-api" target="_blank" rel="noreferrer">
              <BracketsCurlyIcon weight="duotone" className="text-brand" />
              Run this API yourself
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
