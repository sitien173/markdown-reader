import { enUS } from './en-US';

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type I18nKey = NestedKeyOf<typeof enUS>;

export function t(key: I18nKey): string {
  const parts = key.split('.');
  let current: unknown = enUS;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === 'string' ? current : key;
}

export function useT() {
  return t;
}

export function applyLanguage(lang = 'en-US'): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
}
