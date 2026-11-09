import { beforeEach, describe, expect, it, vi } from 'vitest';

const callOrder: string[] = [];

vi.mock('react-dom/client', () => ({
  createRoot: () => ({ render: () => callOrder.push('render') }),
}));
vi.mock('../../src/entrypoints/reader/App', () => ({ default: () => null }));
vi.mock('../../src/styles/globals.css', () => ({}));
vi.mock('../../src/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/i18n')>()),
  applyLanguage: () => callOrder.push('applyLanguage'),
}));

describe('reader boot sequence', () => {
  beforeEach(() => {
    callOrder.length = 0;
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('renders only after load resolves and language is applied', async () => {
    const { useSettingsStore } = await import('../../src/store/settings-store');
    vi.spyOn(useSettingsStore.getState(), 'load').mockImplementation(async () => {
      callOrder.push('load:start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      callOrder.push('load:resolve');
    });
    const { bootReader } = await import('../../src/entrypoints/reader/main');
    await vi.waitFor(() => expect(callOrder).toContain('render'));
    callOrder.length = 0;
    await bootReader(document.createElement('div'));
    expect(callOrder).toEqual(['load:start', 'load:resolve', 'applyLanguage', 'render']);
  });

  it('still applies language and renders when load rejects', async () => {
    vi.resetModules();
    const { useSettingsStore } = await import('../../src/store/settings-store');
    vi.spyOn(useSettingsStore.getState(), 'load').mockRejectedValue(new Error('storage down'));
    const { bootReader } = await import('../../src/entrypoints/reader/main');
    await vi.waitFor(() => expect(callOrder).toContain('render'));
    callOrder.length = 0;
    await bootReader(document.createElement('div'));
    expect(callOrder).toEqual(['applyLanguage', 'render']);
  });
});
