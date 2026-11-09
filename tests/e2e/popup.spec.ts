import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';

type Entry = { role: string; name: string | null; level?: number };
type Fixture = {
  landmark: string;
  rail: string[];
  roleMap: Record<string, string>;
  tabs: Record<string, { entries: Entry[]; missing: string[]; extra: string[]; reason: string }>;
};
const fixture = JSON.parse(readFileSync('tests/fixtures/popup-roles.json', 'utf8')) as Fixture;

type AxNode = {
  ignored?: boolean;
  role?: { value: string };
  name?: { value: string };
  properties?: Array<{ name: string; value: { value: unknown } }>;
};

// The browser's own accessibility tree in document order, through CDP.
async function axNodes(page: Page): Promise<AxNode[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    return ((await cdp.send('Accessibility.getFullAXTree')) as { nodes: AxNode[] }).nodes.filter((node) => !node.ignored);
  } finally {
    await cdp.detach();
  }
}

// Lowercase, because the accessibility name follows CSS text-transform.
const label = (entry: Entry) => `${entry.role}${entry.level ?? ''}:${entry.name ?? '*'}`.toLowerCase();

// Reference entries and ours as normalized role entries. Roles outside the fixture vocabulary are not compared.
function ours(nodes: AxNode[]): Entry[] {
  const compared = new Set(['heading', 'button', 'slider', 'textbox', 'spinbutton', 'combobox', 'radio', 'link']);
  const entries: Entry[] = [];
  for (const node of nodes) {
    const raw = node.role?.value ?? '';
    if (!compared.has(raw)) continue;
    const level = node.properties?.find((p) => p.name === 'level')?.value.value as number | undefined;
    entries.push({ role: fixture.roleMap[raw] ?? raw, name: node.name?.value || null, ...(raw === 'heading' ? { level } : {}) });
  }
  return entries;
}

// Named reference entries match first, then unnamed ones take any remaining entry of the same role.
function diff(reference: Entry[], actual: Entry[]) {
  const left = [...actual];
  const missing: Entry[] = [];
  const take = (ref: Entry) => {
    const at = left.findIndex(
      (a) => a.role === ref.role && a.level === ref.level && (ref.name === null || a.name?.toLowerCase() === ref.name.toLowerCase()),
    );
    if (at < 0) return false;
    left.splice(at, 1);
    return true;
  };
  for (const ref of reference.filter((r) => r.name !== null)) if (!take(ref)) missing.push(ref);
  for (const ref of reference.filter((r) => r.name === null)) if (!take(ref)) missing.push(ref);
  return { missing: missing.map(label).sort(), extra: left.map(label).sort() };
}

test.describe('popup role structure', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.locator('#root > *').first().waitFor();
  });

  test('one main landmark holds a rail of four named controls in the reference order', async ({ page }) => {
    const nodes = await axNodes(page);
    expect(nodes.filter((n) => n.role?.value === fixture.landmark)).toHaveLength(1);
    const rail = nodes.filter((n) => n.role?.value === 'tab').map((n) => n.name?.value);
    expect(rail).toEqual(fixture.rail);
  });

  test('the settings rail is 60 px wide', async ({ page }) => {
    const box = await page.getByRole('tablist').boundingBox();
    expect(box?.width).toBe(60);
  });

  for (const [key, expected] of Object.entries(fixture.tabs)) {
    test(`${key} tab matches the reference roles within the recorded differences`, async ({ page }) => {
      const name = key[0]?.toUpperCase() + key.slice(1);
      await page.getByRole('tab', { name }).click();
      await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
      const panel = await axNodes(page);
      const start = panel.findIndex((n) => n.role?.value === 'tabpanel');
      expect(start, 'tabpanel found').toBeGreaterThan(-1);
      const { missing, extra } = diff(expected.entries, ours(panel.slice(start)));
      expect({ missing, extra }).toEqual({ missing: [...expected.missing].sort(), extra: [...expected.extra].sort() });
    });
  }
});
