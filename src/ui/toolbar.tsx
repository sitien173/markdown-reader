import { ChevronDownIcon, CommandIcon, MaximizeIcon, PanelLeftIcon } from 'lucide-react';
import type { Command, CommandId } from '../reader/commands';
import { formatShortcut } from '../reader/shortcuts';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { useShallow } from 'zustand/react/shallow';
import { MODES, type Mode, useReaderStore } from '../store/reader-store';

export interface ToolbarProps {
  commands: Command[];
  onMode(mode: Mode): void;
}

const modeLabel = (m: Mode) => m.charAt(0).toUpperCase() + m.slice(1);
const paletteHint = formatShortcut('Mod+K');

export function Toolbar({ commands, onMode }: ToolbarProps) {
  const state = useReaderStore(
    useShallow((s) => ({
      text: s.text,
      writable: s.writable,
      mode: s.mode,
      sidebarOpen: s.sidebarOpen,
      docTitle: s.docTitle,
      dirty: s.dirty,
    })),
  );
  const byId = (id: CommandId) => {
    const command = commands.find((c) => c.id === id);
    if (!command) throw new Error(`Unknown command ${id}`);
    return command;
  };
  const enabled = (id: CommandId) => byId(id).available(state);
  const hasDoc = state.text !== null;

  return (
    <header className="reader-bar" data-slot="reader-bar">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle sidebar"
        aria-pressed={state.sidebarOpen}
        onClick={() => byId('toggle-sidebar').run()}
      >
        <PanelLeftIcon aria-hidden="true" />
      </Button>
      <div className="reader-title" data-slot="reader-title">
        <span className="reader-title-text">{state.docTitle || 'Markdown Reader'}</span>
        <span role="status" className="reader-dirty">
          {state.dirty && (
            <>
              <span className="reader-dirty-dot" aria-hidden="true" />
              <span className="sr-only">Unsaved changes</span>
            </>
          )}
        </span>
      </div>
      {hasDoc && (
        <RadioGroup aria-label="Reader mode" value={state.mode} onValueChange={(next) => onMode(next as Mode)}>
          {MODES.map((m) => (
            <RadioGroupItem key={m} value={m}>
              {modeLabel(m)}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      )}
      <div className="reader-bar-end">
        {enabled('save') && (
          <Button variant="secondary" disabled={!state.dirty} onClick={() => byId('save').run()}>
            Save
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="secondary" />}>
            Open
            <ChevronDownIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => byId('open-file').run()}>File</DropdownMenuItem>
            <DropdownMenuItem onClick={() => byId('open-folder').run()}>Folder</DropdownMenuItem>
            <DropdownMenuItem onClick={() => byId('open-url').run()}>URL</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="secondary" aria-label="Export options" />} disabled={state.mode === 'edit'}>
            Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!enabled('export-html')} onClick={() => byId('export-html').run()}>
              Export HTML
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!enabled('print')} onClick={() => byId('print').run()}>
              Print
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {enabled('focus-mode') && (
          <Button variant="ghost" size="icon" aria-label="Focus mode" onClick={() => byId('focus-mode').run()}>
            <MaximizeIcon aria-hidden="true" />
          </Button>
        )}
        <Button variant="outline" aria-label="Command palette" onClick={() => byId('command-palette').run()}>
          <CommandIcon aria-hidden="true" />
          <kbd className="reader-kbd">{paletteHint}</kbd>
        </Button>
      </div>
    </header>
  );
}
