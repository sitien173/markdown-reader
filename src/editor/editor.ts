import { basicSetup, EditorView } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';

export function createEditor(parent: HTMLElement, doc: string, onChange: (text: string) => void): EditorView {
  return new EditorView({
    parent,
    doc,
    extensions: [basicSetup, markdown(), EditorView.updateListener.of((update) => { if (update.docChanged) onChange(update.state.doc.toString()); })],
  });
}
