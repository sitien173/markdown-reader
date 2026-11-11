import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { downloadText } from '../export/export';
import { type JsonParseError, type JsonViewOptions, prepareJson, transformJson, unescapeJson } from '../lib/json-document';
import { enhance } from '../render/enhance';
import { JsonToolbar } from './json-toolbar';
import type { MarkdownViewHandle } from './markdown-view';

export interface JsonViewProps {
  text: string;
  kind: 'json' | 'jsonc';
  source?: string | null;
  onParseError(error: JsonParseError | null): void;
}

function initialOptions(source: string): JsonViewOptions {
  const hasLineBreak = /[\r\n]/.test(source.trim());
  return {
    layout: hasLineBreak ? 'original' : 'beautify',
    indent: 2,
    sortKeys: false,
    stripComments: false,
    escape: false,
  };
}

function sourceStem(source?: string | null): string {
  if (!source) return 'document';
  try {
    const url = new URL(source);
    const pathname = url.pathname;
    const filename = pathname.split('/').filter(Boolean).pop() ?? 'document';
    return decodeURIComponent(filename).replace(/\.(jsonc?|txt|md|markdown)$/i, '') || 'document';
  } catch {
    const filename = source.split(/[\\/]/).filter(Boolean).pop() ?? 'document';
    return filename.replace(/\.(jsonc?|txt|md|markdown)$/i, '') || 'document';
  }
}

export const JsonView = forwardRef<MarkdownViewHandle, JsonViewProps>(function JsonView({ text, kind, source, onParseError }, ref) {
  const codeContainer = useRef<HTMLDivElement>(null);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const onParseErrorRef = useRef(onParseError);
  onParseErrorRef.current = onParseError;
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const currentPromiseRef = useRef<Promise<void> | null>(null);

  const [options, setOptions] = useState<JsonViewOptions>(() => initialOptions(text));
  const [unescaped, setUnescaped] = useState(false);
  const [canUnescape, setCanUnescape] = useState(false);
  const [isParseError, setIsParseError] = useState(false);
  const [decodedParses, setDecodedParses] = useState(true);
  const [hasComments, setHasComments] = useState(false);

  const currentDisplayTextRef = useRef(text);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const unescapedRef = useRef(unescaped);
  unescapedRef.current = unescaped;

  const [prevDocKey, setPrevDocKey] = useState(source ?? text);
  const currentDocKey = source ?? text;
  if (prevDocKey !== currentDocKey) {
    setPrevDocKey(currentDocKey);
    const nextOptions = initialOptions(text);
    setOptions(nextOptions);
    optionsRef.current = nextOptions;
    setUnescaped(false);
    unescapedRef.current = false;
  }

  const paint = useCallback(
    (sourceText: string, currentKind: 'json' | 'jsonc', currentOptions: JsonViewOptions, currentUnescaped: boolean) => {
      const gen = ++genRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const promise = (async () => {
        let error: JsonParseError | null = null;
        try {
          const res = await prepareJson(sourceText, currentKind);
          error = res.error;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          error = { message, line: 1, column: 1 };
        }

        if (gen !== genRef.current || controller.signal.aborted) {
          return;
        }

        if (error) {
          onParseErrorRef.current(error);
          setIsParseError(true);
          setCanUnescape(false);
          currentDisplayTextRef.current = sourceText;
          setHasComments(false);

          const root = codeContainer.current;
          if (!root) return;

          const pre = document.createElement('pre');
          const code = document.createElement('code');
          code.className = currentKind === 'jsonc' ? 'language-jsonc' : 'language-json';
          code.textContent = sourceText;
          pre.appendChild(code);
          root.replaceChildren(pre);

          try {
            await enhance(root, controller.signal);
          } catch {
            // Ignored on abort or failure
          }
          return;
        }

        let unescapeRes: { text: string; parses: boolean } | null = null;
        try {
          unescapeRes = await unescapeJson(sourceText, currentKind);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          onParseErrorRef.current({ message, line: 1, column: 1 });
          setIsParseError(true);
          setCanUnescape(false);
          currentDisplayTextRef.current = sourceText;

          const root = codeContainer.current;
          if (!root) return;
          const pre = document.createElement('pre');
          const code = document.createElement('code');
          code.className = currentKind === 'jsonc' ? 'language-jsonc' : 'language-json';
          code.textContent = sourceText;
          pre.appendChild(code);
          root.replaceChildren(pre);
          try {
            await enhance(root, controller.signal);
          } catch {}
          return;
        }

        if (gen !== genRef.current || controller.signal.aborted) {
          return;
        }

        const canUnescapeVal = unescapeRes !== null;
        setCanUnescape(canUnescapeVal);

        let activeUnescaped = currentUnescaped;
        if (activeUnescaped && !canUnescapeVal) {
          activeUnescaped = false;
          setUnescaped(false);
          unescapedRef.current = false;
        }

        let displayText = sourceText;
        let commentsRemaining = false;
        let codeClass = currentKind === 'jsonc' ? 'language-jsonc' : 'language-json';
        let parsedDecoded = true;

        try {
          if (activeUnescaped && unescapeRes) {
            if (!unescapeRes.parses) {
              parsedDecoded = false;
              displayText = currentOptions.escape ? JSON.stringify(unescapeRes.text) : unescapeRes.text;
              commentsRemaining = false;
              codeClass = currentOptions.escape ? 'language-json' : '';
            } else {
              parsedDecoded = true;
              const res = await transformJson(unescapeRes.text, 'json', currentOptions);
              displayText = res.text;
              commentsRemaining = res.hasComments;
              codeClass = 'language-json';
            }
          } else {
            parsedDecoded = true;
            const res = await transformJson(sourceText, currentKind, currentOptions);
            displayText = res.text;
            commentsRemaining = res.hasComments;
            codeClass = commentsRemaining ? 'language-jsonc' : 'language-json';
          }
          onParseErrorRef.current(null);
          setIsParseError(false);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          onParseErrorRef.current({ message, line: 1, column: 1 });
          setIsParseError(true);
          displayText = sourceText;
          codeClass = currentKind === 'jsonc' ? 'language-jsonc' : 'language-json';
        }

        if (gen !== genRef.current || controller.signal.aborted) {
          return;
        }

        setDecodedParses(parsedDecoded);
        setHasComments(commentsRemaining);
        currentDisplayTextRef.current = displayText;

        const root = codeContainer.current;
        if (!root) return;

        const pre = document.createElement('pre');
        const code = document.createElement('code');
        if (codeClass) {
          code.className = codeClass;
        }
        code.textContent = displayText;
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
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      update(value: string) {
        void paint(value, kindRef.current, optionsRef.current, unescapedRef.current);
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
    void paint(text, kind, options, unescaped);
  }, [text, kind, options, unescaped, paint]);

  useEffect(() => {
    return () => {
      genRef.current++;
      abortRef.current?.abort();
      onParseErrorRef.current(null);
    };
  }, []);

  const handleDownload = useCallback(() => {
    const ext = hasComments ? '.jsonc' : '.json';
    const stem = sourceStem(sourceRef.current);
    const filename = `${stem}${ext}`;
    const textToDownload = currentDisplayTextRef.current;
    downloadText(filename, textToDownload, 'application/json;charset=utf-8');
  }, [hasComments]);

  return (
    <div data-slot="markdown" className="md-content">
      <JsonToolbar
        kind={kind}
        options={options}
        unescaped={unescaped}
        canUnescape={canUnescape}
        disabled={isParseError}
        parses={decodedParses}
        onChange={(next) => {
          setOptions(next);
        }}
        onUnescape={() => {
          setUnescaped(true);
        }}
        onRevert={() => {
          setUnescaped(false);
        }}
        onDownload={handleDownload}
      />
      <div ref={codeContainer} className="json-code" />
    </div>
  );
});
