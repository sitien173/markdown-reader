import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { useT } from '../i18n';
import { AboutTab } from './settings/about-tab';

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogTitle className="sr-only">{t('settings.tabs.about')}</DialogTitle>
        <AboutTab />
      </DialogContent>
    </Dialog>
  );
}
