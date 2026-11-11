import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Command, type CommandDeps, type CommandId, createCommands } from '../../src/reader/commands';
import { parseOpenUrl } from '../../src/lib/schemas';
import { createReaderStore, type ReaderState } from '../../src/store/reader-store';

let deps: { [K in keyof CommandDeps]: ReturnType<typeof vi.fn> };
let commands: Command[];
let base: ReaderState;
const find = (id: CommandId) => {
  const command = commands.find((c) => c.id === id);
  if (!command) throw new Error(`missing command ${id}`);
  return command;
};
const withDoc = (patch: Partial<ReaderState> = {}): ReaderState => ({ ...base, text: '# Doc', ...patch });
const withJsonDoc = (patch: Partial<ReaderState> = {}): ReaderState => ({ ...base, text: '{"key": "value"}', docKind: 'json', ...patch });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  base = createReaderStore().getState();
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
    toggleRaw: vi.fn(),
    toggleFullscreen: vi.fn(),
    openSettings: vi.fn(),
    openAbout: vi.fn(),
    openPalette: vi.fn(),
  };
  commands = createCommands(deps as unknown as CommandDeps);
});

describe('command registry', () => {
  it('registers every v1 action with a unique id and a label', () => {
    const ids = commands.map((c) => c.id);
    expect(ids).toEqual([
      'open-file',
      'open-folder',
      'open-url',
      'save',
      'mode-read',
      'mode-edit',
      'mode-split',
      'export-html',
      'print',
      'toggle-sidebar',
      'focus-mode',
      'toggle-raw',
      'toggle-fullscreen',
      'settings',
      'about',
      'command-palette',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of commands) expect(c.label.length).toBeGreaterThan(0);
  });

  it('runs each command through its dependency', () => {
    find('open-file').run();
    find('open-folder').run();
    find('open-url').run();
    find('save').run();
    find('mode-read').run();
    find('mode-edit').run();
    find('mode-split').run();
    find('export-html').run();
    find('print').run();
    find('toggle-sidebar').run();
    find('focus-mode').run();
    find('toggle-raw').run();
    find('toggle-fullscreen').run();
    find('settings').run();
    find('about').run();
    find('command-palette').run();
    expect(deps.openFile).toHaveBeenCalledTimes(1);
    expect(deps.openFolder).toHaveBeenCalledTimes(1);
    expect(deps.openUrl).toHaveBeenCalledTimes(1);
    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.setMode.mock.calls).toEqual([['read'], ['edit'], ['split']]);
    expect(deps.exportHtml).toHaveBeenCalledTimes(1);
    expect(deps.print).toHaveBeenCalledTimes(1);
    expect(deps.toggleSidebar).toHaveBeenCalledTimes(1);
    expect(deps.toggleFocusMode).toHaveBeenCalledTimes(1);
    expect(deps.toggleRaw).toHaveBeenCalledTimes(1);
    expect(deps.toggleFullscreen).toHaveBeenCalledTimes(1);
    expect(deps.openSettings).toHaveBeenCalledTimes(1);
    expect(deps.openAbout).toHaveBeenCalledTimes(1);
    expect(deps.openPalette).toHaveBeenCalledTimes(1);
  });

  it('invokes the picker commands synchronously, with no await before the dependency', () => {
    find('open-file').run();
    expect(deps.openFile).toHaveBeenCalledTimes(1);
    find('open-folder').run();
    expect(deps.openFolder).toHaveBeenCalledTimes(1);
  });

  it('keeps open and sidebar commands available without a document', () => {
    for (const id of [
      'open-file',
      'open-folder',
      'open-url',
      'toggle-sidebar',
      'toggle-fullscreen',
      'settings',
      'about',
      'command-palette',
    ] as const)
      expect(find(id).available(base)).toBe(true);
  });

  it('disables document commands without a document', () => {
    for (const id of ['save', 'mode-read', 'mode-edit', 'mode-split', 'export-html', 'print', 'focus-mode', 'toggle-raw'] as const)
      expect(find(id).available(base), id).toBe(false);
  });

  it('enables document commands when a document is open', () => {
    for (const id of ['mode-read', 'mode-edit', 'mode-split', 'focus-mode', 'toggle-raw'] as const)
      expect(find(id).available(withDoc()), id).toBe(true);
  });

  it('offers save only for a writable document', () => {
    expect(find('save').available(withDoc({ writable: false }))).toBe(false);
    expect(find('save').available(withDoc({ writable: true }))).toBe(true);
  });

  it('disables export and print in edit mode', () => {
    expect(find('export-html').available(withDoc({ mode: 'read' }))).toBe(true);
    expect(find('print').available(withDoc({ mode: 'split' }))).toBe(true);
    expect(find('export-html').available(withDoc({ mode: 'edit' }))).toBe(false);
    expect(find('print').available(withDoc({ mode: 'edit' }))).toBe(false);
  });

  it('documents the shortcut hints used by the toolbar and the palette', () => {
    expect(find('save').shortcut).toBe('Mod+S');
    expect(find('open-file').shortcut).toBe('Mod+O');
    expect(find('toggle-sidebar').shortcut).toBe('Mod+\\');
    expect(find('print').shortcut).toBe('Mod+P');
    expect(find('command-palette').shortcut).toBe('Mod+K');
  });
});

describe('Phase 6 commands', () => {
  it('labels the new commands and relabels focus-mode as Zen mode without changing its id', () => {
    expect(find('toggle-raw').label).toBe('Toggle Raw');
    expect(find('toggle-fullscreen').label).toBe('Toggle Fullscreen');
    expect(find('settings').label).toBe('Settings');
    expect(find('about').label).toBe('About');
    expect(find('focus-mode').label).toBe('Zen mode');
  });

  it('binds no shortcut beyond the five existing ones', () => {
    const bound = Object.fromEntries(commands.filter((c) => c.shortcut).map((c) => [c.id, c.shortcut]));
    expect(bound).toEqual({
      'open-file': 'Mod+O',
      save: 'Mod+S',
      print: 'Mod+P',
      'toggle-sidebar': 'Mod+\\',
      'command-palette': 'Mod+K',
    });
  });
});

describe('Open URL check', () => {
  it('accepts http, https, and file URLs and trims the value', () => {
    expect(parseOpenUrl('  https://e.test/a.md ')).toEqual({ ok: true, url: 'https://e.test/a.md' });
    expect(parseOpenUrl('http://e.test/a.md')).toEqual({ ok: true, url: 'http://e.test/a.md' });
    expect(parseOpenUrl('file:///tmp/a.md')).toEqual({ ok: true, url: 'file:///tmp/a.md' });
  });
  it('rejects a disallowed scheme with an inline message', () => {
    expect(parseOpenUrl('javascript:alert(1)')).toEqual({ ok: false, message: 'This URL scheme is not supported' });
    expect(parseOpenUrl('ftp://e.test/a.md')).toEqual({ ok: false, message: 'This URL scheme is not supported' });
  });
  it('rejects empty and malformed input', () => {
    expect(parseOpenUrl('   ')).toEqual({ ok: false, message: 'Enter a Markdown URL' });
    expect(parseOpenUrl('not a url')).toEqual({ ok: false, message: 'Enter a valid URL' });
  });
});

describe('JSON command availability', () => {
  it('disables save, mode-edit, mode-split, toggle-raw, and export-html for JSON documents', () => {
    const jsonState = withJsonDoc({ writable: true, mode: 'read' });
    expect(find('save').available(jsonState)).toBe(false);
    expect(find('mode-edit').available(jsonState)).toBe(false);
    expect(find('mode-split').available(jsonState)).toBe(false);
    expect(find('toggle-raw').available(jsonState)).toBe(false);
    expect(find('export-html').available(jsonState)).toBe(false);
  });

  it('keeps print, mode-read, focus-mode, and open commands available for JSON documents', () => {
    const jsonState = withJsonDoc({ writable: true, mode: 'read' });
    expect(find('print').available(jsonState)).toBe(true);
    expect(find('mode-read').available(jsonState)).toBe(true);
    expect(find('focus-mode').available(jsonState)).toBe(true);
    expect(find('open-file').available(jsonState)).toBe(true);
    expect(find('open-folder').available(jsonState)).toBe(true);
    expect(find('open-url').available(jsonState)).toBe(true);
    expect(find('command-palette').available(jsonState)).toBe(true);
  });

  it('also disables those commands for jsonc kind', () => {
    const jsoncState = withJsonDoc({ docKind: 'jsonc', writable: true, mode: 'read' });
    expect(find('save').available(jsoncState)).toBe(false);
    expect(find('mode-edit').available(jsoncState)).toBe(false);
    expect(find('mode-split').available(jsoncState)).toBe(false);
    expect(find('toggle-raw').available(jsoncState)).toBe(false);
    expect(find('export-html').available(jsoncState)).toBe(false);
    expect(find('print').available(jsoncState)).toBe(true);
  });
});
