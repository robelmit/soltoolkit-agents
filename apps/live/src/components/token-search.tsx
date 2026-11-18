import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { isAddress } from '@/lib/format';
import { go } from '@/lib/route';

/** Paste a mint, go to its token page. */
export function TokenSearch({ initial = '', autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(initial), [initial]);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!isAddress(text)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    go('token', text.trim());
  };
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-1.5">
      <div className="flex gap-2">
        <InputGroup className="h-10 flex-1">
          <InputGroupAddon>
            <MagnifyingGlassIcon />
          </InputGroupAddon>
          <InputGroupInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a token mint address" aria-label="Token mint address" aria-invalid={invalid} autoFocus={autoFocus} className="font-mono text-sm" spellCheck={false} />
        </InputGroup>
        <Button type="submit" size="lg" className="h-10">
          Check
        </Button>
      </div>
      {invalid && <p className="text-sm text-destructive">That is not a Solana address.</p>}
    </form>
  );
}
