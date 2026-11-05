import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export function TopBar({
  source,
  onNavigate,
  onOpenFile,
  onOpenFolder,
  onExportHtml,
  onPrint,
  exportDisabled,
}: {
  source: string;
  onNavigate: (url: string) => void;
  onOpenFile: () => void;
  onOpenFolder?: () => void;
  onExportHtml?: () => void;
  onPrint?: () => void;
  exportDisabled?: boolean;
}) {
  const [url, setUrl] = useState(source);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (url.trim()) onNavigate(url.trim());
  }

  return (
    <header className="tds-custom-reader__bar">
      <form className="tds-custom-reader__url" onSubmit={submit}>
        <label className="tds-field-label" htmlFor="reader-url">
          Markdown URL
        </label>
        <Input
          id="reader-url"
          className="tds-text-input__field"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/readme.md"
        />
        <Button type="submit">Open URL</Button>
      </form>
      <Button variant="secondary" onClick={onOpenFile}>
        Open file
      </Button>
      {onOpenFolder ? (
        <Button variant="secondary" onClick={onOpenFolder}>
          Open folder
        </Button>
      ) : null}
      <div className="tds-button-menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" aria-label="Export options" disabled={exportDisabled}>
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportHtml}>
              Export HTML
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPrint}>
              Print
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
