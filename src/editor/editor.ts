import { basicSetup, EditorView } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Colors are CSS variables set in editor.css, so the syntax theme follows prefers-color-scheme without JS.
const highlightStyle = HighlightStyle.define([
  { tag: [tags.heading, tags.link, tags.url], color: 'var(--cm-accent)' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator, tags.comment, tags.quote], color: 'var(--cm-subtle)' },
  { tag: tags.heading, fontWeight: 'bold' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, color: 'var(--cm-code)' },
]);

export function createEditor(parent: HTMLElement, doc: string, onChange: (text: string) => void): EditorView {
  return new EditorView({
    parent,
    doc,
    extensions: [
      basicSetup,
      syntaxHighlighting(highlightStyle),
      markdown(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString());
      }),
    ],
  });
}
