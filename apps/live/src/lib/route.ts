import { useEffect, useState } from 'react';

/** The pages, addressed by the URL's hash so the site is static files and a link can be shared. */
export type Page = 'launches' | 'token' | 'wallet' | 'apps' | 'developers' | 'embed';
export interface Route {
  readonly page: Page;
  /** The token page's and the embed's mint, or the apps page's transaction signature. */
  readonly param: string | null;
}

const PAGES: readonly Page[] = ['launches', 'token', 'wallet', 'apps', 'developers', 'embed'];

export function parseRoute(hash: string): Route {
  const [page, param] = hash.replace(/^#\/?/, '').split('/');
  return PAGES.includes(page as Page) ? { page: page as Page, param: param ? decodeURIComponent(param) : null } : { page: 'launches', param: null };
}

export const href = (page: Page, param?: string | null): string => `#/${page}${param ? `/${encodeURIComponent(param)}` : ''}`;

export function go(page: Page, param?: string | null): void {
  window.location.hash = href(page, param);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const update = (): void => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}

/** Calls `load` now and every `ms` while the page is visible. */
export function usePoll(load: () => void, ms: number, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, ms);
    return () => clearInterval(timer);
    // `load` is expected to be stable (useCallback).
  }, [load, ms, enabled]);
}
