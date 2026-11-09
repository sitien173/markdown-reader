import type { ReactNode } from 'react';
import { InfoIcon, PaletteIcon, PuzzleIcon, SettingsIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useT } from '../../i18n';
import { AboutTab } from './about-tab';
import { AppearanceTab } from './appearance-tab';
import { GeneralTab } from './general-tab';
import { PluginsTab } from './plugins-tab';

/** One settings row: label and description on the left, control on the right. */
export function SettingRow({
  label,
  description,
  labelId,
  children,
}: {
  label: string;
  description?: string;
  labelId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div id={labelId} className="text-sm font-medium">
          {label}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const sections = [
  { id: 'general', icon: SettingsIcon, tab: GeneralTab },
  { id: 'appearance', icon: PaletteIcon, tab: AppearanceTab },
  { id: 'plugins', icon: PuzzleIcon, tab: PluginsTab },
  { id: 'about', icon: InfoIcon, tab: AboutTab },
] as const;

/** The reader dialog hides Render current tab: there, the current tab is the reader itself. */
export function SettingsPanel({ showRenderCurrent = true }: { showRenderCurrent?: boolean }) {
  const t = useT();
  return (
    <Tabs defaultValue="general" orientation="vertical" className="h-full w-full gap-0" data-slot="settings-panel">
      <TabsList
        aria-label={t('settings.rail')}
        variant="line"
        className="w-[60px] shrink-0 group-data-[orientation=vertical]/tabs:h-full justify-start gap-1 border-r bg-muted/40 px-2 py-3"
      >
        {sections.map(({ id, icon: Icon }) => (
          <TabsTrigger key={id} value={id} aria-label={t(`settings.tabs.${id}`)} className="h-9 flex-none justify-center">
            <Icon aria-hidden="true" />
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map(({ id, tab: Tab }) => (
        <TabsContent key={id} value={id} className="min-w-0 overflow-y-auto p-4">
          {Tab === GeneralTab ? <GeneralTab showRenderCurrent={showRenderCurrent} /> : <Tab />}
        </TabsContent>
      ))}
    </Tabs>
  );
}
