import { CheckIcon, CodeIcon, ShareNetworkIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

/**
 * Share and embed a token. Share copies a line with the token's page link (`/t/<mint>`, which shows a preview card
 * when pasted into Telegram, Discord or X); Embed copies the frame code of its holder map for another site.
 */
export function ShareButtons({ mint, name, grade }: { mint: string; name: string; grade: string | null }) {
  const share = useCopyToClipboard();
  const embed = useCopyToClipboard();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const line = `${name}${grade ? `: safety ${grade}` : ''}, checked on soltoolkit Live ${origin}/t/${mint}`;
  const frame = `<iframe src="${origin}/#/embed/${mint}" width="800" height="560" style="border:0;border-radius:20px" title="${name.replace(/"/g, '')} holder map" loading="lazy"></iframe>`;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => share.copyToClipboard(line)} aria-label="Copy a share line with the link">
        {share.isCopied ? <CheckIcon weight="bold" /> : <ShareNetworkIcon weight="duotone" />}
        {share.isCopied ? 'Copied' : 'Share'}
      </Button>
      <Button variant="outline" size="sm" onClick={() => embed.copyToClipboard(frame)} aria-label="Copy the holder map's embed code">
        {embed.isCopied ? <CheckIcon weight="bold" /> : <CodeIcon weight="duotone" />}
        {embed.isCopied ? 'Copied' : 'Embed map'}
      </Button>
    </div>
  );
}
