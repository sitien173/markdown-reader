import type { BundledLanguage } from 'shiki';
import type { LanguageRegistration, ThemeRegistration } from '@shikijs/core';

type LangModule = { default: LanguageRegistration[] };
const languages = new Map<string, Promise<LangModule>>();
function loadLanguage(language: string): Promise<LangModule> {
  let loaded = languages.get(language);
  if (!loaded) {
    switch (language) {
      case 'javascript': loaded = import('@shikijs/langs/javascript'); break;
      case 'typescript': loaded = import('shiki/langs/typescript.mjs'); break;
      case 'json': loaded = import('shiki/langs/json.mjs'); break;
      case 'html': loaded = import('shiki/langs/html.mjs'); break;
      case 'css': loaded = import('@shikijs/langs/css'); break;
      case 'bash': loaded = import('shiki/langs/bash.mjs'); break;
      case 'markdown': loaded = import('shiki/langs/markdown.mjs'); break;
      case 'python': loaded = import('shiki/langs/python.mjs'); break;
      case 'rust': loaded = import('shiki/langs/rust.mjs'); break;
      case 'go': loaded = import('shiki/langs/go.mjs'); break;
      case 'yaml': loaded = import('shiki/langs/yaml.mjs'); break;
      default: return Promise.reject(new Error(`Unsupported language: ${language}`));
    }
    languages.set(language, loaded);
  }
  return loaded;
}
const supported = new Set<BundledLanguage>(['javascript', 'typescript', 'json', 'html', 'css', 'bash', 'markdown', 'python', 'rust', 'go', 'yaml']);
let highlighterPromise: ReturnType<typeof createHighlighter> | undefined;
function createHighlighter() {
  return Promise.all([
    import('shiki/core'), import('@shikijs/engine-javascript'), import('shiki/themes/github-light.mjs'),
  ]).then(([core, engine, theme]) => core.createHighlighterCore({ themes: [theme.default as ThemeRegistration], langs: [], engine: engine.createJavaScriptRegexEngine() }));
}
const getHighlighter = () => (highlighterPromise ??= createHighlighter());

export async function highlight(source: string, language: string): Promise<string | null> {
  if (new TextEncoder().encode(source).byteLength > 200 * 1024) return null;
  const aliases: Record<string, string> = { js: 'javascript', ts: 'typescript', shell: 'bash', py: 'python', rs: 'rust', yml: 'yaml', sh: 'bash', md: 'markdown' };
  const lang = aliases[language.toLowerCase()] ?? language.toLowerCase();
  if (!supported.has(lang as BundledLanguage)) return `<pre><code>${escapeHtml(source)}</code></pre>`;
  try {
    const [highlighter, langModule] = await Promise.all([getHighlighter(), loadLanguage(lang)]);
    await highlighter.loadLanguage(langModule.default);
    return highlighter.codeToHtml(source, { lang, theme: 'github-light' });
  } catch {
    return `<pre><code>${escapeHtml(source)}</code></pre>`;
  }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
