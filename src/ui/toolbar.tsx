import type { Command, CommandId } from '../reader/commands';
import { Button } from '../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { useShallow } from 'zustand/react/shallow';
import { MODES, type Mode, useReaderStore } from '../store/reader-store';

export interface ToolbarProps {
  commands: Command[];
  onMode(mode: Mode): void;
}

const modeLabel = (m: Mode) => m.charAt(0).toUpperCase() + m.slice(1);

/** Compact header for edit and split modes: title, unsaved dot, Save, and the mode switch. Every other action lives in the floating menu. */
export function Toolbar({ commands, onMode }: ToolbarProps) {
  const state = useReaderStore(
    useShallow((s) => ({
      text: s.text,
      writable: s.writable,
      mode: s.mode,
      docTitle: s.docTitle,
      dirty: s.dirty,
    })),
  );
  const byId = (id: CommandId) => {
    const command = commands.find((c) => c.id === id);
    if (!command) throw new Error(`Unknown command ${id}`);
    return command;
  };
  const hasDoc = state.text !== null;

  return (
    <header className="reader-bar" data-slot="reader-bar">
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
      {byId('save').available(state) && (
        <Button variant="secondary" disabled={!state.dirty} onClick={() => byId('save').run()}>
          Save
        </Button>
      )}
      {hasDoc && (
        <RadioGroup aria-label="Reader mode" value={state.mode} onValueChange={(next) => onMode(next as Mode)}>
          {MODES.map((m) => (
            <RadioGroupItem key={m} value={m}>
              {modeLabel(m)}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      )}
    </header>
  );
}
