function keyOf(kind: string, language: string, source: string): string {
  return `${kind}\0${language}\0${source}`;
}

export function createBlockCache<T>(capacity = 200) {
  const values = new Map<string, T>();
  const touch = (key: string, value: T): T => {
    values.delete(key);
    values.set(key, value);
    return value;
  };
  const trim = () => {
    while (values.size > capacity) values.delete(values.keys().next().value!);
  };
  return {
    get size() { return values.size; },
    get(kind: string, language: string, source: string): T | undefined {
      const key = keyOf(kind, language, source);
      const value = values.get(key);
      return value === undefined ? undefined : touch(key, value);
    },
    set(kind: string, language: string, source: string, value: T): void {
      touch(keyOf(kind, language, source), value);
      trim();
    },
    getOrCreate(kind: string, language: string, source: string, create: () => T): T {
      const key = keyOf(kind, language, source);
      if (values.has(key)) return touch(key, values.get(key)!);
      const value = create();
      values.set(key, value);
      trim();
      return value;
    },
  };
}
