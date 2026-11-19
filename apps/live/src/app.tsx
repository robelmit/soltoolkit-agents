import { CodeIcon, DiscordLogoIcon, FingerprintIcon, GithubLogoIcon, RocketLaunchIcon, ShieldCheckIcon, TelegramLogoIcon, WalletIcon } from '@phosphor-icons/react';
import { cn } from 'cn';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrandMark } from '@/components/brand';
import { Surface } from '@/components/panel';
import { TokenSearch } from '@/components/token-search';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { health } from '@/lib/api';
import { discordInvite, telegramInvite } from '@/lib/bots';
import { href, useRoute, type Page } from '@/lib/route';
import { LaunchesPage } from '@/pages/launches';

// The first page loads with the site; the others, and the holder-map viewer, load when opened.
const TokenPage = lazy(() => import('@/pages/token').then((m) => ({ default: m.TokenPage })));
const WalletPage = lazy(() => import('@/pages/wallet').then((m) => ({ default: m.WalletPage })));
const AppsPage = lazy(() => import('@/pages/apps').then((m) => ({ default: m.AppsPage })));
const DevelopersPage = lazy(() => import('@/pages/developers').then((m) => ({ default: m.DevelopersPage })));
const EmbedPage = lazy(() => import('@/pages/token').then((m) => ({ default: m.EmbedPage })));

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
        <span tabIndex={0} className="hidden items-center gap-2.5 rounded-full border border-border bg-card py-1 pr-3.5 pl-1 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex">
          <span className={cn('grid size-8 place-items-center rounded-full', up === null ? 'bg-muted' : up ? 'bg-primary-light' : 'bg-destructive/15')}>
            <span className={cn('size-2 rounded-full', up === null ? 'bg-muted-foreground' : up ? 'animate-pulse bg-success' : 'bg-destructive')} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[13px] font-bold">{up === null ? 'Connecting' : up ? 'Mainnet' : 'API offline'}</span>
            <span className="text-[11px] text-muted-foreground">{up ? 'Live data' : 'Demo API'}</span>
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{up ? 'Reading Solana mainnet through the free demo API' : 'The demo API is not answering'}</TooltipContent>
    </Tooltip>
  );
}

function Intro() {
  return (
    <Surface className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-xl">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {['Open source', 'MIT', 'No keys held'].map((label, i) => (
            <span key={label} className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-bold', i === 0 ? 'bg-primary-light text-primary-text' : 'border border-border text-muted-foreground')}>
              {label}
            </span>
          ))}
        </div>
        <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.035em] text-balance sm:text-[36px]">Tools for Solana launchpads, running live on mainnet</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">Launches as they happen, token safety, holder clusters, quotes, wallet scores and the apps behind trades. Every number on this site comes from the open-source soltoolkit packages.</p>
      </div>
      <div className="flex w-full flex-col gap-3 lg:max-w-md">
        <TokenSearch />
        <AddBots />
      </div>
    </Surface>
  );
}

/** Add the hosted bots to a group or a server: token cards, buy posts, alerts and calls there. */
function AddBots() {
  if (!telegramInvite && !discordInvite) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] text-muted-foreground">Bring the cards to your community:</span>
      {telegramInvite && (
        <a href={telegramInvite} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] font-semibold transition-colors hover:bg-muted">
          <TelegramLogoIcon weight="duotone" className="size-4 text-primary" />
          Add to Telegram
        </a>
      )}
      {discordInvite && (
        <a href={discordInvite} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] font-semibold transition-colors hover:bg-muted">
          <DiscordLogoIcon weight="duotone" className="size-4 text-primary" />
          Add to Discord
        </a>
      )}
    </div>
  );
}

export function App() {
  const route = useRoute();
  // On a phone the page tabs scroll sideways: keep the open one in view.
  useEffect(() => {
    document.querySelector('nav[data-mobile] [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [route.page]);
  // In another site's frame: the holder map alone, with a credit that opens the full page.
  if (route.page === 'embed')
    return (
      <div className="flex min-h-svh flex-col gap-2 bg-background p-3">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-[20px]" />}>
          <EmbedPage mint={route.param} />
        </Suspense>
        <a href={`${window.location.origin}/${href('token', route.param)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 self-end text-[12px] text-muted-foreground hover:text-foreground">
          <BrandMark className="size-4" />
          soltoolkit live
        </a>
      </div>
    );
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <a href={href('launches')} className="flex items-center gap-2" aria-label="soltoolkit Live home">
            <BrandMark className="size-8" />
            <span className="text-[19px] leading-none font-extrabold tracking-[-0.04em]">
              soltoolkit<span className="text-primary"> live</span>
            </span>
          </a>
          <nav className="mx-auto hidden h-10 items-center gap-0.5 rounded-full bg-muted/70 p-1 shadow-[inset_0_0_0_0.5px_var(--border)] lg:flex" aria-label="Pages">
            {NAV.map(({ page, label, Icon }) => (
              <a
                key={page}
                href={href(page)}
                aria-current={route.page === page ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13.5px] tracking-[-0.01em] whitespace-nowrap transition-colors',
                  route.page === page ? 'bg-card font-semibold text-foreground shadow-[0_1px_0_var(--border-shadow),inset_0_0_0_0.5px_var(--border)]' : 'font-medium text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon weight={route.page === page ? 'duotone' : 'regular'} className={cn('size-[18px]', route.page === page && 'text-primary')} />
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <ApiStatus />
            <a href="https://github.com/robelmit/soltoolkit-sdk" target="_blank" rel="noreferrer" aria-label="soltoolkit on GitHub" className="grid size-9 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-muted">
              <GithubLogoIcon weight="duotone" className="size-[18px]" />
            </a>
          </div>
        </div>
        <div className="overflow-x-auto px-4 pb-3 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
          <nav data-mobile className="flex w-max items-center gap-0.5 rounded-full bg-muted/70 p-1 shadow-[inset_0_0_0_0.5px_var(--border)]" aria-label="Pages">
            {NAV.map(({ page, label, Icon }) => (
              <a
                key={page}
                href={href(page)}
                aria-current={route.page === page ? 'page' : undefined}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] whitespace-nowrap',
                  route.page === page ? 'bg-card font-semibold text-foreground shadow-[0_1px_0_var(--border-shadow),inset_0_0_0_0.5px_var(--border)]' : 'font-medium text-muted-foreground',
                )}
              >
                <Icon weight={route.page === page ? 'duotone' : 'regular'} className={cn('size-[18px]', route.page === page && 'text-primary')} />
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-6">
        {route.page === 'launches' && (
          <>
            <Intro />
            <LaunchesPage />
          </>
        )}
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-[20px]" />}>
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
