import type { ReaderState } from '../store/reader-store';
import type { Command } from './commands';

export type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'isComposing' | 'target'>;

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}

/** Hint text for a registry shortcut such as `Mod+O`: `⌘O` on macOS, `Ctrl+O` elsewhere. */
export function formatShortcut(shortcut: string, isMac: boolean = isMacPlatform()): string {
  const key = shortcut.replace(/^Mod\+/, '');
  return isMac ? `⌘${key}` : `Ctrl+${key}`;
}

/** Typing targets own their keystrokes. CodeMirror is contenteditable but still takes shortcuts, so Cmd/Ctrl+S saves from the editor. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('.cm-editor')) return false;
  return target.matches('input, textarea, select') || target.isContentEditable || target.getAttribute('contenteditable') === 'true';
}

/** A modal dialog other than a toast is open and not already closing, so keys belong to it. */
function isModalOpen(): boolean {
  return (
    document.querySelector(
      '[role="dialog"]:not([data-slot="toast"], [data-ending-style]), [role="alertdialog"]:not([data-ending-style])',
    ) !== null
  );
}

export function matchShortcut(event: ShortcutEvent, commands: Command[], isMac: boolean): Command | null {
  if (event.isComposing || event.altKey || event.shiftKey) return null;
  if (isMac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return null;
  if (isTypingTarget(event.target)) return null;
  const key = event.key.toLowerCase();
  return commands.find((c) => c.shortcut?.replace(/^Mod\+/, '').toLowerCase() === key) ?? null;
}

/** Routes Mod+key through the command registry. The command runs inside the keydown handler, so pickers keep the user gesture. */
export function bindShortcuts(
  getCommands: () => Command[],
  getState: () => ReaderState,
  target: Window = window,
  isMac: boolean = isMacPlatform(),
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const command = matchShortcut(event, getCommands(), isMac);
    if (!command) return;
    event.preventDefault();
    // Focus on a dialog button is not a typing target; the browser default stays blocked but nothing runs behind the dialog.
    if (isModalOpen()) return;
    if (command.available(getState())) command.run();
  };
  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}
