import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import type { Banner } from '../store/reader-store';

export interface StatusBannerProps {
  banners: NonNullable<Banner>[];
  onRetry(): void;
  onDismissError(): void;
  onReload(): void;
}

/** Shows every persistent condition. An error never hides the external-change prompt, so dismissing it keeps Reload. */
export function StatusBanner({ banners, onRetry, onDismissError, onReload }: StatusBannerProps) {
  if (banners.length === 0) return null;
  return (
    <div className="reader-banners" data-slot="status-banner">
      {banners.map((banner) =>
        banner.kind === 'error' ? (
          <Alert key="error" variant="destructive" className="flex items-center gap-3">
            <span className="flex-1">{banner.message}</span>
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
            <Button variant="ghost" onClick={onDismissError}>
              Dismiss
            </Button>
          </Alert>
        ) : banner.kind === 'jsonError' ? (
          <Alert key="jsonError" variant="destructive" className="flex items-center gap-3">
            <span className="flex-1">
              {banner.message === 'Empty document' ? banner.message : `${banner.message} (line ${banner.line}, column ${banner.column})`}
            </span>
          </Alert>
        ) : (
          <Alert key="externalChange" role="status" className="flex items-center gap-3">
            <span className="flex-1">File changed on disk</span>
            <Button variant="secondary" onClick={onReload}>
              Reload
            </Button>
          </Alert>
        ),
      )}
    </div>
  );
}
