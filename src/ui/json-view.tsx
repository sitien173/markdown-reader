import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { MarkdownViewHandle } from './markdown-view';
import { type JsonParseError, prepareJson } from '../lib/json-document';
import { enhance } from '../render/enhance';

export interface JsonViewProps {
  text: string;
  kind: 'json' | 'jsonc';
  onParseError(error: JsonParseError | null): void;
}

export const JsonView = forwardRef<MarkdownViewHandle, JsonViewProps>(function JsonView({ text, kind, onParseError }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const onParseErrorRef = useRef(onParseError);
  onParseErrorRef.current = onParseError;
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const currentPromiseRef = useRef<Promise<void> | null>(null);

  const paint = useCallback((sourceText: string, currentKind: 'json' | 'jsonc') => {
    const gen = ++genRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const promise = (async () => {
      let preparedText = sourceText;
      let error: JsonParseError | null = null;
      try {
        const res = await prepareJson(sourceText, currentKind);
        preparedText = res.text;
        error = res.error;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error = { message, line: 1, column: 1 };
        preparedText = sourceText;
      }

      if (gen !== genRef.current || controller.signal.aborted) {
        return;
      }

      onParseErrorRef.current(error);

      const root = container.current;
      if (!root) return;

      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = currentKind === 'jsonc' ? 'language-jsonc' : 'language-json';
      code.textContent = preparedText;
      pre.appendChild(code);
      root.replaceChildren(pre);

      try {
        await enhance(root, controller.signal);
      } catch {
        // Ignored on abort or failure
      }
    })();

    currentPromiseRef.current = promise;
    return promise;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      update(value: string) {
        void paint(value, kindRef.current);
      },
      async ready(): Promise<void> {
        while (currentPromiseRef.current) {
          const p = currentPromiseRef.current;
          await p;
          if (p === currentPromiseRef.current) break;
        }
      },
    }),
    [paint],
  );

  useEffect(() => {
    void paint(text, kind);
  }, [text, kind, paint]);

  useEffect(() => {
    return () => {
      genRef.current++;
      abortRef.current?.abort();
    };
  }, []);

  return <div ref={container} data-slot="markdown" className="md-content" />;
});
