import { describe, expect, it } from 'vitest';
import { usableCapturedText } from '../../src/source/captured-text';

describe('captured session text', () => {
  it('rejects entries older than 30 seconds', () => {
    expect(
      usableCapturedText({ url: 'https://example.test/a.md', text: 'old', ts: 69_999 }, 'https://example.test/a.md', 100_000),
    ).toBeUndefined();
  });
  it('rejects text belonging to a different URL', () => {
    expect(
      usableCapturedText({ url: 'https://example.test/a.md', text: 'wrong', ts: 99_999 }, 'https://example.test/b.md', 100_000),
    ).toBeUndefined();
  });
});
