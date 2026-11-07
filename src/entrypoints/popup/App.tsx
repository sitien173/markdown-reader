import { useEffect, useState } from 'react';
import { BookOpenIcon, GlobeIcon, PencilIcon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { getRecentUrls } from '../../store/recent';
import { isAllowedUrl } from '../../source/url';
import { FileAccessDialog } from '../../ui/file-access-dialog';

export default function App() {
  const [recent, setRecent] = useState<string[]>([]);
  const [fileAccessOpen, setFileAccessOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void getRecentUrls().then(setRecent);
  }, []);
  async function open(action: string, url?: string) {
    if (url && !isAllowedUrl(url)) {
      setError('This URL scheme cannot be opened.');
      return;
    }
    setError('');
    await browser.runtime.sendMessage({ action, url });
  }
  async function renderCurrent() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !isAllowedUrl(tab.url)) {
      setError('This page URL cannot be opened.');
      return;
    }
    if (tab.url.startsWith('file:') && !(await browser.extension.isAllowedFileSchemeAccess())) {
      setFileAccessOpen(true);
      return;
    }
    await open('render-current', tab.url);
  }
  return (
    <main className="popup">
      {error && (
        <p role="alert" className="popup-error">
          {error}
        </p>
      )}
      <div className="popup-actions">
        <Button variant="ghost" className="popup-action" onClick={() => void open('open-viewer')}>
          <BookOpenIcon aria-hidden="true" />
          Open viewer
        </Button>
        <Button variant="ghost" className="popup-action" onClick={() => void open('open-editor')}>
          <PencilIcon aria-hidden="true" />
          Open editor
        </Button>
        <Button variant="ghost" className="popup-action" onClick={() => void renderCurrent()}>
          <GlobeIcon aria-hidden="true" />
          Render current tab
        </Button>
      </div>
      <section aria-label="Recent URLs" className="popup-recents">
        <h2 className="popup-recents-title">Recent</h2>
        {recent.length ? (
          <TooltipProvider delay={300}>
            {recent.map((url) => (
              <Tooltip key={url}>
                <TooltipTrigger
                  render={<Button className="popup-recent-url" variant="ghost" onClick={() => void open('open-viewer', url)} />}
                >
                  {url}
                </TooltipTrigger>
                <TooltipContent side="bottom" className="popup-tooltip">
                  {url}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        ) : (
          <p className="popup-empty">No recent URLs</p>
        )}
      </section>
      <FileAccessDialog open={fileAccessOpen} onOpenChange={setFileAccessOpen} />
    </main>
  );
}
