import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { getRecentUrls } from '../../store/recent';
import { isAllowedUrl } from '../../source/url';
import { FileAccessDialog } from '../../ui/file-access-dialog';

export default function App() {
  const [recent, setRecent] = useState<string[]>([]);
  const [fileAccessOpen, setFileAccessOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void getRecentUrls().then(setRecent); }, []);
  async function open(action: string, url?: string) {
    if (url && !isAllowedUrl(url)) { setError('This URL scheme cannot be opened.'); return; }
    setError('');
    await browser.runtime.sendMessage({ action, url });
  }
  async function renderCurrent() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !isAllowedUrl(tab.url)) { setError('This page URL cannot be opened.'); return; }
    if (tab.url.startsWith('file:') && !(await browser.extension.isAllowedFileSchemeAccess())) {
      setFileAccessOpen(true);
      return;
    }
    await open('render-current', tab.url);
  }
  return <main className="tds-custom-popup">
    {error && <p role="alert">{error}</p>}
    <Button onClick={() => void open('open-viewer')}>Open viewer</Button>
    <Button variant="secondary" onClick={() => void open('open-editor')}>Open editor</Button>
    <Button variant="secondary" onClick={() => void renderCurrent()}>Render current tab</Button>
    <section aria-label="Recent URLs"><h2 className="text-body-md">Recent</h2>{recent.length ? recent.map(url => <Button key={url} className="tds-custom-popup__recent-url" variant="ghost" onClick={() => void open('open-viewer', url)} title={url}>{url}</Button>) : <p>No recent URLs</p>}</section>
    <FileAccessDialog open={fileAccessOpen} onOpenChange={setFileAccessOpen} />
  </main>;
}
