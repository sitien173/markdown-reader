import { FileTextIcon, FolderOpenIcon, LinkIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { RecentItem } from '../store/recent';
import { RecentSection } from './recent-section';

export interface WelcomeProps {
  recents: RecentItem[];
  onOpenFile(): void;
  onOpenFolder(): void;
  onOpenUrl(): void;
  onOpenRecent(item: RecentItem): void | Promise<void>;
  onRefreshRecents(): void | Promise<void>;
  onAnnouncement(message: string): void;
}

export function Welcome({ recents, onOpenFile, onOpenFolder, onOpenUrl, onOpenRecent, onRefreshRecents, onAnnouncement }: WelcomeProps) {
  return (
    <div className="reader-welcome" data-slot="welcome">
      <h1 className="reader-welcome-title">Markdown Reader</h1>
      <p className="reader-welcome-hint">Open a Markdown file, a folder, or a URL. You can also drop a file anywhere in this window.</p>
      <div className="reader-welcome-actions">
        <Button onClick={onOpenFile}>
          <FileTextIcon aria-hidden="true" />
          Open file
        </Button>
        <Button variant="secondary" onClick={onOpenFolder}>
          <FolderOpenIcon aria-hidden="true" />
          Open folder
        </Button>
        <Button variant="secondary" onClick={onOpenUrl}>
          <LinkIcon aria-hidden="true" />
          Open URL
        </Button>
      </div>
      <RecentSection items={recents} onOpenItem={onOpenRecent} onRefresh={onRefreshRecents} onAnnouncement={onAnnouncement} />
    </div>
  );
}
