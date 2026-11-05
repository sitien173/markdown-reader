import type { RecentItem } from '../store/recent';
import { requestHandlePermission } from '../store/handles';
import { Button } from '../components/ui/button';

export interface RecentSectionProps {
  items: RecentItem[];
  onOpenItem: (item: RecentItem) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  onAnnouncement?: (message: string) => void;
}

export function RecentSection({ items, onOpenItem, onRefresh, onAnnouncement }: RecentSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="tds-custom-reader__recents">
      <div className="tds-custom-reader__recents-title">Recent</div>
      <ul className="tds-custom-reader__recents-list">
        {items.map(item => (
          <li key={item.id} className="tds-custom-reader__recents-item">
            {item.kind === 'handle' && item.entry.requiresReconnect ? (
              <>
                <span className="text-body-sm">{item.title}</span>
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
              <button
                type="button"
                className="tds-side-nav__nav-item text-body-sm"
                onClick={() => void onOpenItem(item)}
              >
                {item.title}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
