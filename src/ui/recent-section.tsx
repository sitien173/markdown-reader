import type { RecentItem } from '../store/recent';
import { requestHandlePermission } from '../store/handles';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { FileText, Folder } from 'lucide-react';

export interface RecentSectionProps {
  items: RecentItem[];
  onOpenItem: (item: RecentItem) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  onAnnouncement?: (message: string) => void;
}

export function RecentSection({ items, onOpenItem, onRefresh, onAnnouncement }: RecentSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="reader-recents">
      <div className="reader-recents-title">Recent</div>
      <TooltipProvider delay={200}>
        <ul className="reader-recents-list">
          {items.map((item) => (
            <li key={item.id} className="reader-recents-item">
              {item.kind === 'handle' && item.entry.requiresReconnect ? (
                <>
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className="text-sm truncate min-w-0 flex-1 max-w-[150px] cursor-default" title={item.title} />}
                    >
                      {item.title}
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const perm = await requestHandlePermission(item.entry.handle);
                        if (perm === 'granted') {
                          await onOpenItem(item);
                        } else {
                          onAnnouncement?.(`Permission was not granted to access "${item.title}".`);
                        }
                      } catch (e) {
                        onAnnouncement?.(e instanceof Error ? e.message : 'Unable to reconnect');
                      }
                      await onRefresh?.();
                    }}
                  >
                    Reconnect
                  </Button>
                </>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button type="button" className="nav-item min-w-0 w-full" onClick={() => void onOpenItem(item)} title={item.title} />
                    }
                  >
                    {item.kind === 'handle' && item.entry.type === 'folder' ? (
                      <Folder className="nav-folder-closed" aria-hidden="true" />
                    ) : (
                      <FileText className="nav-file-icon" aria-hidden="true" />
                    )}
                    <span className="truncate min-w-0 flex-1">{item.title}</span>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              )}
            </li>
          ))}
        </ul>
      </TooltipProvider>
    </div>
  );
}
