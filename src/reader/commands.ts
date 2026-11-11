import type { Mode, ReaderState } from '../store/reader-store';

export type CommandId =
  | 'open-file'
  | 'open-folder'
  | 'open-url'
  | 'save'
  | 'mode-read'
  | 'mode-edit'
  | 'mode-split'
  | 'export-html'
  | 'print'
  | 'toggle-sidebar'
  | 'focus-mode'
  | 'toggle-raw'
  | 'toggle-fullscreen'
  | 'settings'
  | 'about'
  | 'command-palette';

/** The state slice command availability reads, so subscribers can select just these fields. */
export type CommandState = Pick<ReaderState, 'text' | 'writable' | 'mode'> & { docKind?: ReaderState['docKind'] };

export interface Command {
  id: CommandId;
  label: string;
  shortcut?: string;
  available(state: CommandState): boolean;
  run(): void;
}

export interface CommandDeps {
  openFile(): void;
  openFolder(): void;
  openUrl(): void;
  save(): void;
  setMode(mode: Mode): void;
  exportHtml(): void;
  print(): void;
  toggleSidebar(): void;
  toggleFocusMode(): void;
  toggleRaw(): void;
  toggleFullscreen(): void;
  openSettings(): void;
  openAbout(): void;
  openPalette(): void;
}

const hasDoc = (s: CommandState) => s.text !== null;
const isMarkdown = (s: CommandState) => s.docKind !== 'json' && s.docKind !== 'jsonc';
const canExport = (s: CommandState) => hasDoc(s) && s.mode !== 'edit';
const always = () => true;

/** Single registry for menu, palette, and shortcuts. Picker commands call straight through so they stay inside the user gesture. */
export function createCommands(deps: CommandDeps): Command[] {
  return [
    { id: 'open-file', label: 'Open file', shortcut: 'Mod+O', available: always, run: () => deps.openFile() },
    { id: 'open-folder', label: 'Open folder', available: always, run: () => deps.openFolder() },
    { id: 'open-url', label: 'Open URL', available: always, run: () => deps.openUrl() },
    { id: 'save', label: 'Save', shortcut: 'Mod+S', available: (s) => isMarkdown(s) && hasDoc(s) && s.writable, run: () => deps.save() },
    { id: 'mode-read', label: 'Read mode', available: hasDoc, run: () => deps.setMode('read') },
    { id: 'mode-edit', label: 'Edit mode', available: (s) => isMarkdown(s) && hasDoc(s), run: () => deps.setMode('edit') },
    { id: 'mode-split', label: 'Split mode', available: (s) => isMarkdown(s) && hasDoc(s), run: () => deps.setMode('split') },
    { id: 'export-html', label: 'Export HTML', available: (s) => isMarkdown(s) && canExport(s), run: () => deps.exportHtml() },
    { id: 'print', label: 'Print', shortcut: 'Mod+P', available: canExport, run: () => deps.print() },
    { id: 'toggle-sidebar', label: 'Toggle sidebar', shortcut: 'Mod+\\', available: always, run: () => deps.toggleSidebar() },
    { id: 'focus-mode', label: 'Zen mode', available: hasDoc, run: () => deps.toggleFocusMode() },
    { id: 'toggle-raw', label: 'Toggle Raw', available: (s) => isMarkdown(s) && hasDoc(s), run: () => deps.toggleRaw() },
    { id: 'toggle-fullscreen', label: 'Toggle Fullscreen', available: always, run: () => deps.toggleFullscreen() },
    { id: 'settings', label: 'Settings', available: always, run: () => deps.openSettings() },
    { id: 'about', label: 'About', available: always, run: () => deps.openAbout() },
    { id: 'command-palette', label: 'Command palette', shortcut: 'Mod+K', available: always, run: () => deps.openPalette() },
  ];
}
