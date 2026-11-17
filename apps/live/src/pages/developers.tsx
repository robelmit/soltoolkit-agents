import { ArrowSquareOutIcon, BracketsCurlyIcon, CubeIcon, GithubLogoIcon, PackageIcon, PlugsConnectedIcon, RobotIcon } from '@phosphor-icons/react';
import { Panel } from '@/components/panel';
import { Badge } from '@/components/reui/badge';
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle } from '@/components/reui/code-block/code-block';
import { IconTile } from '@/components/reui/icon-tile';
import { Button } from '@/components/ui/button';
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

function Snippet({ title, code, language }: { title: string; code: string; language: string }) {
  return (
    <CodeBlock code={code} language={language}>
      <CodeBlockHeader>
        <CodeBlockTitle>{title}</CodeBlockTitle>
        <CodeBlockLanguage />
        <CodeBlockCopyButton className="ml-auto" />
      </CodeBlockHeader>
    </CodeBlock>
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
        <Panel title="Install from npm" description="Nine packages, each usable on its own. ESM and CommonJS, typed, Node 20 or later." icon={<PackageIcon weight="duotone" />}>
          <div className="flex flex-col gap-3">
            <Snippet title="Terminal" language="bash" code="npm i @soltoolkit/launchpad-sdk @soltoolkit/token-safety" />
            <div className="flex flex-wrap gap-1.5">
              {PACKAGES.map((p) => (
                <Badge key={p} variant="secondary" className="font-mono">
                  @soltoolkit/{p}
                </Badge>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Give an AI agent the tools" description="A read-only MCP server: quote, grade a token, map holders, name the app behind a trade. No tool signs or sends." icon={<RobotIcon weight="duotone" />}>
          <Snippet title="MCP client config" language="json" code={mcpConfig} />
        </Panel>
      </div>

      <Panel
        title="The free API behind this site"
        description={
          <>
            JSON over HTTP, a small budget per client, cross-origin allowed. Base URL <span className="font-mono">{origin}</span>
          </>
        }
        icon={<PlugsConnectedIcon weight="duotone" />}
        flush
      >
        <ul className="divide-y">
          {ROUTES.map(([method, path, what]) => (
            <li key={path} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <Badge variant={method === 'GET' ? 'info-light' : 'warning-light'} className="w-12 justify-center font-mono">
                {method}
              </Badge>
              <span className="font-mono text-xs break-all">{path}</span>
              <span className="text-sm text-muted-foreground sm:ml-auto">{what}</span>
            </li>
          ))}
        </ul>
        <div className="border-t p-3">
          <Snippet title="Try it" language="bash" code={`curl ${origin}/v1/tokens/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/safety`} />
        </div>
      </Panel>

      <Panel title="Source" description="Five repositories, so each piece can be used, forked and contributed to on its own." icon={<GithubLogoIcon weight="duotone" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPOS.map((r) => (
            <a key={r.name} href={`https://github.com/robelmit/${r.name}`} target="_blank" rel="noreferrer" className="group flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/60">
              <IconTile variant="frame" size="sm">
                <CubeIcon weight="duotone" />
              </IconTile>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 font-mono text-sm font-medium">
                  {r.name}
                  <ArrowSquareOutIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="text-xs text-muted-foreground">{r.what}</span>
              </span>
            </a>
          ))}
          <Button variant="outline" asChild className="h-auto justify-start p-3">
            <a href="https://github.com/robelmit/soltoolkit-agents/tree/main/apps/demo-api" target="_blank" rel="noreferrer">
              <BracketsCurlyIcon weight="duotone" className="text-brand" />
              Run this API yourself
            </a>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
