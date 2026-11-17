import { ArrowSquareOutIcon, CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { short } from '@/lib/format';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A copy button that confirms with a check. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={label} onClick={async (e) => { e.stopPropagation(); setCopied(await copyText(text)); }}>
          {copied ? <CheckIcon weight="bold" className="text-success" /> : <CopyIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied' : label}</TooltipContent>
    </Tooltip>
  );
}

/** An address in short form, with copy and a link to Solscan. */
export function Address({ value, href, keep = 4, className }: { value: string; href?: string; keep?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-xs ${className ?? ''}`}>
      <span title={value}>{short(value, keep)}</span>
      <CopyButton text={value} label="Copy address" />
      {href && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" asChild>
              <a href={href} target="_blank" rel="noreferrer" aria-label="Open in Solscan" onClick={(e) => e.stopPropagation()}>
                <ArrowSquareOutIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in Solscan</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
