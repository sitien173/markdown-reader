import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Command, type CommandDeps, createCommands } from '../../src/reader/commands';
import { bindShortcuts, matchShortcut, type ShortcutEvent } from '../../src/reader/shortcuts';
import { createReaderStore, type ReaderState } from '../../src/store/reader-store';

let deps: { [K in keyof CommandDeps]: ReturnType<typeof vi.fn> };
let commands: Command[];
let state: ReaderState;

const key = (k: string, init: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  target: document.body,
  ...init,
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  state = { ...createReaderStore().getState(), text: '# Doc', writable: true };
  deps = {
    openFile: vi.fn(),
    openFolder: vi.fn(),
    openUrl: vi.fn(),
    save: vi.fn(),
    setMode: vi.fn(),
    exportHtml: vi.fn(),
    print: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleFocusMode: vi.fn(),
    openPalette: vi.fn(),
  };
  commands = createCommands(deps as unknown as CommandDeps);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('matchShortcut', () => {
  it.each([
    ['k', 'command-palette'],
    ['s', 'save'],
    ['o', 'open-file'],
    ['\\', 'toggle-sidebar'],
    ['p', 'print'],
  ])('maps Cmd+%s on macOS to %s', (k, id) => {
    expect(matchShortcut(key(k, { metaKey: true }), commands, true)?.id).toBe(id);
  });

  it('maps Ctrl+key elsewhere and is case-insensitive', () => {
    expect(matchShortcut(key('K', { ctrlKey: true }), commands, false)?.id).toBe('command-palette');
    expect(matchShortcut(key('s', { ctrlKey: true }), commands, false)?.id).toBe('save');
  });

  it('uses Cmd only on macOS and Ctrl only elsewhere', () => {
    expect(matchShortcut(key('s', { ctrlKey: true }), commands, true)).toBeNull();
    expect(matchShortcut(key('s', { metaKey: true }), commands, false)).toBeNull();
  });

  it('ignores unmodified keys, extra modifiers, and unbound keys', () => {
    expect(matchShortcut(key('s'), commands, false)).toBeNull();
    expect(matchShortcut(key('s', { ctrlKey: true, shiftKey: true }), commands, false)).toBeNull();
    expect(matchShortcut(key('s', { ctrlKey: true, altKey: true }), commands, false)).toBeNull();
    expect(matchShortcut(key('x', { ctrlKey: true }), commands, false)).toBeNull();
  });

  it('ignores composition events', () => {
    expect(matchShortcut(key('s', { ctrlKey: true, isComposing: true }), commands, false)).toBeNull();
  });

  it('ignores text inputs, textareas, selects, and plain contenteditable', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.body.appendChild(document.createElement(tag));
      expect(matchShortcut(key('o', { ctrlKey: true, target: el }), commands, false), tag).toBeNull();
    }
    const editable = document.body.appendChild(document.createElement('div'));
    editable.setAttribute('contenteditable', 'true');
    expect(matchShortcut(key('o', { ctrlKey: true, target: editable }), commands, false)).toBeNull();
  });

  it('still matches inside the CodeMirror editor', () => {
    const cm = document.body.appendChild(document.createElement('div'));
    cm.className = 'cm-editor';
    const content = cm.appendChild(document.createElement('div'));
    content.className = 'cm-content';
    content.setAttribute('contenteditable', 'true');
    expect(matchShortcut(key('s', { ctrlKey: true, target: content }), commands, false)?.id).toBe('save');
  });
});

describe('bindShortcuts', () => {
  function bind(isMac = false) {
    return bindShortcuts(
      () => commands,
      () => state,
      window,
      isMac,
    );
  }
  const press = (init: KeyboardEventInit & { key: string }) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    document.body.dispatchEvent(event);
    return event;
  };

  it('runs the command and prevents the browser default', () => {
    const off = bind();
    const event = press({ key: 'o', ctrlKey: true });
    expect(deps.openFile).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    off();
  });

  it('runs picker shortcuts synchronously inside the keydown dispatch', () => {
    const off = bind();
    press({ key: 'o', ctrlKey: true });
    expect(deps.openFile).toHaveBeenCalledTimes(1);
    off();
  });

  it('runs save and print through the registry', () => {
    const off = bind(true);
    press({ key: 's', metaKey: true });
    press({ key: 'p', metaKey: true });
    press({ key: '\\', metaKey: true });
    press({ key: 'k', metaKey: true });
    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.print).toHaveBeenCalledTimes(1);
    expect(deps.toggleSidebar).toHaveBeenCalledTimes(1);
    expect(deps.openPalette).toHaveBeenCalledTimes(1);
    off();
  });

  it('prevents the browser default but does not run an unavailable command', () => {
    state = { ...state, text: null };
    const off = bind();
    const event = press({ key: 's', ctrlKey: true });
    expect(deps.save).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    off();
  });

  it('leaves typing in an input alone', () => {
    const off = bind();
    const input = document.body.appendChild(document.createElement('input'));
    const event = new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(deps.openFile).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    off();
  });

  describe('while a modal dialog is open', () => {
    function openDialog(role = 'dialog', attrs: Record<string, string> = {}) {
      const dialog = document.body.appendChild(document.createElement('div'));
      dialog.setAttribute('role', role);
      for (const [name, value] of Object.entries(attrs)) dialog.setAttribute(name, value);
      return dialog.appendChild(document.createElement('button'));
    }
    const pressFrom = (target: HTMLElement, init: KeyboardEventInit & { key: string }) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };

    it('does not run a command from a dialog button but still blocks the browser default', () => {
      const off = bind();
      const button = openDialog();
      const event = pressFrom(button, { key: 'o', ctrlKey: true });
      expect(deps.openFile).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
      off();
    });

    it.each([
      ['k', 'openPalette'],
      ['s', 'save'],
      ['\\', 'toggleSidebar'],
      ['p', 'print'],
    ] as const)('does not run Ctrl+%s behind an alert dialog', (k, dep) => {
      const off = bind();
      pressFrom(openDialog('alertdialog'), { key: k, ctrlKey: true });
      expect(deps[dep]).not.toHaveBeenCalled();
      off();
    });

    it('ignores a dialog that is closing and a toast', () => {
      const off = bind();
      openDialog('dialog', { 'data-ending-style': '' });
      openDialog('dialog', { 'data-slot': 'toast' });
      press({ key: 'o', ctrlKey: true });
      expect(deps.openFile).toHaveBeenCalledTimes(1);
      off();
    });

    it('runs commands again once the dialog is gone', () => {
      const off = bind();
      const button = openDialog();
      pressFrom(button, { key: 'o', ctrlKey: true });
      button.parentElement?.remove();
      press({ key: 'o', ctrlKey: true });
      expect(deps.openFile).toHaveBeenCalledTimes(1);
      off();
    });
  });

  it('stops listening after cleanup', () => {
    bind()();
    press({ key: 'o', ctrlKey: true });
    expect(deps.openFile).not.toHaveBeenCalled();
  });
});
