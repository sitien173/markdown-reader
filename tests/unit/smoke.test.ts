import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('smoke test', () => {
  it('combines class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
});
