import { useEffect, useRef } from 'react';
import type { EditorView } from 'codemirror';
import { createEditor } from '../editor/editor';

// Mounts CodeMirror imperatively. Keystrokes never touch React state.
export function EditorPane({ initialText, onChange }: { initialText: string; onChange: (text: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const view: EditorView = createEditor(host.current!, initialText, (text) => onChangeRef.current(text));
    return () => view.destroy();
    // initialText is applied on mount; the parent remounts this pane with a key when the source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={host} className="tds-custom-editor" />;
}
