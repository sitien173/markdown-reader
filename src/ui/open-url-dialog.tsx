import { type FormEvent, useState } from 'react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { parseOpenUrl } from '../lib/schemas';

export function OpenUrlDialog({
  open,
  onOpenChange,
  onOpenUrl,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onOpenUrl(url: string): void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function close(next: boolean) {
    if (!next) setError('');
    onOpenChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseOpenUrl(value);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    onOpenUrl(result.url);
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Open URL</DialogTitle>
            <DialogDescription>Enter the address of a Markdown file. http, https, and file URLs are supported.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="reader-url" className="text-sm font-medium">
              Markdown URL
            </label>
            <Input
              id="reader-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              value={value}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'reader-url-error' : undefined}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://example.com/readme.md"
            />
            {error && (
              <p id="reader-url-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit">Open URL</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
