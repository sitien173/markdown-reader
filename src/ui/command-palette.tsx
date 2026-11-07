import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../components/ui/command';
import type { Command as ReaderCommand } from '../reader/commands';
import { formatShortcut } from '../reader/shortcuts';
import { requestHandlePermission } from '../store/handles';
import type { RecentItem } from '../store/recent';
import { useReaderStore } from '../store/reader-store';
import type { TreeNode } from '../source/directory';
import { scrollToHeading } from './toc-panel';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  commands: ReaderCommand[];
  onSelectTreeFile(path: string): void;
  onOpenRecent(item: RecentItem): void | Promise<void>;
  onRefreshRecents?(): void | Promise<void>;
  onAnnouncement?(message: string): void;
}

interface Entry {
  value: string;
  label: string;
  disabled?: boolean;
  shortcut?: string;
  run(): void;
}
interface EntryGroup {
  [key: string]: unknown;
  value: string;
  items: Entry[];
}

function flattenFiles(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.kind === 'file' ? [n.path] : flattenFiles(n.children)));
}

export function CommandPalette({ open, onOpenChange, ...rest }: CommandPaletteProps) {
  // Opening another dialog from an item must keep the focus that dialog just took.
  const handoff = useRef(false);
  const onClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  const onHandoff = useCallback(() => {
    handoff.current = true;
  }, []);
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={() => !handoff.current}
      // Re-armed on every open, so Escape after an earlier handoff still restores focus.
      onOpenChangeComplete={(next) => {
        if (next) handoff.current = false;
      }}
    >
      <PaletteBody {...rest} onClose={onClose} onHandoff={onHandoff} />
    </CommandDialog>
  );
}

function PaletteBody({
  commands,
  onSelectTreeFile,
  onOpenRecent,
  onRefreshRecents,
  onAnnouncement,
  onClose,
  onHandoff,
}: Omit<CommandPaletteProps, 'open' | 'onOpenChange'> & { onClose(): void; onHandoff(): void }) {
  // The body is mounted only while the palette is open; these fields refresh the groups on watcher updates.
  const state = useReaderStore(
    useShallow((s) => ({
      headings: s.headings,
      treeNodes: s.treeNodes,
      recents: s.recents,
      text: s.text,
      writable: s.writable,
      mode: s.mode,
    })),
  );
  const groups = useMemo<EntryGroup[]>(() => {
    const actions = commands
      .filter((c) => c.id !== 'command-palette')
      .map<Entry>((c) => ({
        value: `action:${c.id}`,
        label: c.label,
        disabled: !c.available(state),
        shortcut: c.shortcut ? formatShortcut(c.shortcut) : undefined,
        run: () => {
          if (c.id === 'open-url') onHandoff();
          c.run();
        },
      }));
    const headings = state.headings.map<Entry>((h, i) => ({
      value: `heading:${i}:${h.id}`,
      label: h.text,
      run: () => scrollToHeading(h.id),
    }));
    const files = flattenFiles(state.treeNodes).map<Entry>((path) => ({
      value: `file:${path}`,
      label: path,
      run: () => onSelectTreeFile(path),
    }));
    const recents = state.recents.map<Entry>((item) => ({
      value: `recent:${item.id}`,
      label: item.title,
      run: () => void openRecent(item),
    }));
    return [
      { value: 'Actions', items: actions },
      { value: 'Headings', items: headings },
      { value: 'Folder files', items: files },
      { value: 'Recents', items: recents },
    ].filter((g) => g.items.length > 0);

    // Same reconnect path as the Recent list: permission first, from the click.
    async function openRecent(item: RecentItem) {
      if (item.kind === 'handle' && item.entry.requiresReconnect) {
        try {
          const permission = await requestHandlePermission(item.entry.handle);
          if (permission !== 'granted') {
            onAnnouncement?.(`Permission was not granted to access "${item.title}".`);
            return;
          }
        } catch (e) {
          onAnnouncement?.(e instanceof Error ? e.message : 'Unable to reconnect');
          return;
        } finally {
          await onRefreshRecents?.();
        }
      }
      await onOpenRecent(item);
    }
  }, [commands, state, onSelectTreeFile, onOpenRecent, onRefreshRecents, onAnnouncement, onHandoff]);

  // The command runs first, in this handler, so picker commands keep the user gesture; closing follows.
  const choose = (entry: Entry) => {
    entry.run();
    onClose();
  };

  return (
    <Command items={groups}>
      <CommandInput placeholder="Type a command or search" aria-label="Command palette" />
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandList>
        {(group: EntryGroup) => (
          <CommandGroup key={group.value} items={group.items}>
            <CommandGroupLabel>{group.value}</CommandGroupLabel>
            <CommandCollection>
              {(entry: Entry) => (
                <CommandItem key={entry.value} value={entry} disabled={entry.disabled} onClick={() => choose(entry)}>
                  <span className="truncate">{entry.label}</span>
                  {entry.shortcut && <CommandShortcut>{entry.shortcut}</CommandShortcut>}
                </CommandItem>
              )}
            </CommandCollection>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
