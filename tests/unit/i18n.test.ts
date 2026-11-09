import { beforeEach, describe, expect, it } from 'vitest';
import { applyLanguage, t, useT } from '../../src/i18n';

describe('i18n dictionary and helpers', () => {
  beforeEach(() => {
    document.documentElement.lang = '';
  });

  it("t('contextMenu.open') returns Open in Markdown Reader", () => {
    expect(t('contextMenu.open')).toBe('Open in Markdown Reader');
  });

  it('useT() returns the t translation function', () => {
    const translate = useT();
    expect(translate('contextMenu.open')).toBe('Open in Markdown Reader');
  });

  it("applyLanguage('en-US') sets document.documentElement.lang to en-US", () => {
    applyLanguage('en-US');
    expect(document.documentElement.lang).toBe('en-US');
  });

  it('rejects a mistyped key at typecheck time', () => {
    // @ts-expect-error not a dictionary key
    expect(t('contextMenu.opne')).toBe('contextMenu.opne');
  });
});
