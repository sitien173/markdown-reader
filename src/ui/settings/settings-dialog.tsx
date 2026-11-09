import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog';
import { useT } from '../../i18n';
import { SettingsPanel } from './settings-panel';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 grid-rows-1 h-[480px] w-[520px] max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-w-[520px]">
        <DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
        <SettingsPanel showRenderCurrent={false} />
      </DialogContent>
    </Dialog>
  );
}
