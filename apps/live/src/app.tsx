import { CodeIcon, FingerprintIcon, GithubLogoIcon, RocketLaunchIcon, ShieldCheckIcon, WalletIcon } from '@phosphor-icons/react';
import { cn } from 'cn';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrandMark } from '@/components/brand';
import { Badge } from '@/components/reui/badge';
import { Frame, FramePanel } from '@/components/reui/frame';
import { TokenSearch } from '@/components/token-search';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { health } from '@/lib/api';
import { href, useRoute, type Page } from '@/lib/route';
import { LaunchesPage } from '@/pages/launches';

// The first page loads with the site; the others, and the holder-map viewer, load when opened.
const TokenPage = lazy(() => import('@/pages/token').then((m) => ({ default: m.TokenPage })));
const WalletPage = lazy(() => import('@/pages/wallet').then((m) => ({ default: m.WalletPage })));
const AppsPage = lazy(() => import('@/pages/apps').then((m) => ({ default: m.AppsPage })));
const DevelopersPage = lazy(() => import('@/pages/developers').then((m) => ({ default: m.DevelopersPage })));

const NAV: { page: Page; label: string; Icon: typeof RocketLaunchIcon }[] = [
  { page: 'launches', label: 'Launches', Icon: RocketLaunchIcon },
  { page: 'token', label: 'Token check', Icon: ShieldCheckIcon },
  { page: 'wallet', label: 'Wallet', Icon: WalletIcon },
  { page: 'apps', label: 'Trading apps', Icon: FingerprintIcon },
  { page: 'developers', label: 'Developers', Icon: CodeIcon },
];

/** Whether the API answers, asked every 30 seconds. */
function ApiStatus() {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    const check = (): void => void health().then((h) => setUp(h?.ok === true));
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={up === null ? 'outline' : up ? 'success-light' : 'destructive-light'} size="lg" radius="full" className="hidden sm:inline-flex">
          <span className={cn('size-1.5 rounded-full', up === null ? 'bg-muted-foreground' : up ? 'bg-success' : 'bg-destructive')} />
          {up === null ? 'Connecting' : up ? 'Mainnet' : 'API offline'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{up ? 'Reading Solana mainnet through the free demo API' : 'The demo API is not answering'}</TooltipContent>
    </Tooltip>
  );
}

function Intro() {
  return (
    <Frame spacing="lg">
      <FramePanel className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Badge variant="primary-light">Open source</Badge>
            <Badge variant="outline">MIT</Badge>
            <Badge variant="outline">No keys held</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Tools for Solana launchpads, running live on mainnet</h1>
          <p className="mt-3 text-muted-foreground">Launches as they happen, token safety, holder clusters, quotes, wallet scores and the apps behind trades. Every number on this site comes from the open-source soltoolkit packages.</p>
        </div>
        <div className="w-full lg:max-w-md">
          <TokenSearch />
        </div>
      </FramePanel>
    </Frame>
  );
}

export function App() {
  const route = useRoute();
  // On a phone the page tabs scroll sideways: keep the open one in view.
  useEffect(() => {
    document.querySelector('nav[data-mobile] [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [route.page]);
  return (
    <div className="flex min-h-svh flex-col bg-muted/40 dark:bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <a href={href('launches')} className="flex items-center gap-2.5 font-semibold tracking-tight">
            <BrandMark className="size-7" />
            soltoolkit
            <Badge variant="primary-light" size="sm">
              Live
            </Badge>
          </a>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Pages">
            {NAV.map(({ page, label, Icon }) => (
              <a key={page} href={href(page)} aria-current={route.page === page ? 'page' : undefined} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', route.page === page && 'bg-muted font-medium text-foreground')}>
                <Icon weight={route.page === page ? 'duotone' : 'regular'} className="size-4" />
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ApiStatus />
            <Button variant="ghost" size="icon" asChild>
              <a href="https://github.com/robelmit/soltoolkit-sdk" target="_blank" rel="noreferrer" aria-label="soltoolkit on GitHub">
                <GithubLogoIcon weight="duotone" className="size-5" />
              </a>
            </Button>
          </div>
        </div>
        <nav data-mobile className="flex gap-1 overflow-x-auto border-t px-3 py-1.5 md:hidden" aria-label="Pages">
          {NAV.map(({ page, label, Icon }) => (
            <a key={page} href={href(page)} aria-current={route.page === page ? 'page' : undefined} className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground', route.page === page && 'bg-muted font-medium text-foreground')}>
              <Icon weight={route.page === page ? 'duotone' : 'regular'} className="size-4" />
              {label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        {route.page === 'launches' && (
          <>
            <Intro />
            <LaunchesPage />
          </>
        )}
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          {route.page === 'token' && <TokenPage mint={route.param} />}
          {route.page === 'wallet' && <WalletPage />}
          {route.page === 'apps' && <AppsPage signature={route.param} />}
          {route.page === 'developers' && <DevelopersPage />}
        </Suspense>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <BrandMark className="size-5" />
            soltoolkit is open source under the MIT licence. It reads public chain data and never holds a key.
          </span>
          <span>
            From the team behind{' '}
            <a href="https://hexa.trade" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              Hexa
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
