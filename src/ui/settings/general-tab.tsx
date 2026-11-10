import { useCallback, useEffect, useState } from 'react';
import { BookOpenIcon, GlobeIcon, PencilIcon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Slider } from '../../components/ui/slider';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { type I18nKey, useT } from '../../i18n';
import type { Settings } from '../../lib/settings';
import { isAllowedUrl } from '../../source/url';
import { clampIntervalSec } from '../../source/watch';
import { useSettingsStore } from '../../store/settings-store';
import { getRecentUrls } from '../../store/recent';
import { FileAccessDialog } from '../file-access-dialog';
import { SettingRow } from './settings-panel';

function IntervalControl({ value, onCommit }: { value: number; onCommit: (seconds: number) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(String(value));
  const [sliderDraft, setSliderDraft] = useState<number | null>(null);
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clampIntervalSec(parsed);
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <div className="flex items-center justify-end gap-3">
      <div className="w-32">
        <span id="general-autoRefreshIntervalSlider" className="sr-only">
          {t('settings.general.autoRefreshIntervalSlider')}
        </span>
        <Slider
          aria-labelledby="general-autoRefreshIntervalSlider"
          min={0.5}
          max={600}
          step={0.5}
          value={[sliderDraft ?? value]}
          onValueChange={(next) => setSliderDraft([next].flat()[0] ?? null)}
          onValueCommitted={(next) => {
            setSliderDraft(null);
            onCommit(clampIntervalSec([next].flat()[0] ?? value));
          }}
        />
      </div>
      <Input
        type="number"
        className="w-20"
        aria-label={t('settings.general.autoRefreshIntervalField')}
        min={0.5}
        max={600}
        step={0.5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </div>
  );
}

function IgnorePatternsControl({ value, onCommit }: { value: string; onCommit: (patterns: string) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div>
        <div className="text-sm font-medium">{t('settings.general.ignorePatterns')}</div>
        <p className="text-xs text-muted-foreground">{t('settings.general.ignorePatternsDescription')}</p>
      </div>
      <Textarea
        aria-label={t('settings.general.ignorePatternsField')}
        spellCheck={false}
        rows={3}
        className="font-mono text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}

export function GeneralTab({ showRenderCurrent = true }: { showRenderCurrent?: boolean }) {
  const t = useT();
  const general = useSettingsStore((s) => s.settings.general);
  const breaks = useSettingsStore((s) => s.settings.plugins.breaks);
  const update = useSettingsStore((s) => s.update);
  const [fileAccess, setFileAccess] = useState<boolean | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [fileAccessOpen, setFileAccessOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState('');
  const languages = [{ value: 'en-US', label: t('settings.general.languageEnglish') }];
  // Read only: the state is shown, never requested. Chrome changes it on chrome://extensions, so re-read when this page regains focus.
  const refreshFileAccess = useCallback(() => {
    void Promise.resolve()
      .then(() => browser.extension.isAllowedFileSchemeAccess())
      .then(setFileAccess, () => setFileAccess(false));
  }, []);
  useEffect(() => {
    refreshFileAccess();
    window.addEventListener('focus', refreshFileAccess);
    return () => window.removeEventListener('focus', refreshFileAccess);
  }, [refreshFileAccess]);
  const save = (patch: Parameters<typeof update>[0]) =>
    update(patch).then(
      () => setError(''),
      (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
    );
  const toggle = (
    key: keyof Pick<
      Settings['general'],
      'enabled' | 'outlineCollapsing' | 'renderTxt' | 'autoRefresh' | 'autoRefreshRemote' | 'charsetCompat' | 'showHiddenItems'
    >,
  ) => {
    const name = key === 'enabled' ? 'enable' : key;
    return (
      <SettingRow
        label={t(`settings.general.${name}` as I18nKey)}
        description={t(`settings.general.${name}Description` as I18nKey)}
        labelId={`general-${key}`}
      >
        <Switch
          aria-labelledby={`general-${key}`}
          checked={general[key]}
          onCheckedChange={(checked) => void save({ general: { [key]: checked } })}
        />
      </SettingRow>
    );
  };
  const fileAccessState =
    fileAccess === null
      ? t('settings.general.fileAccessChecking')
      : t(fileAccess ? 'settings.general.fileAccessAllowed' : 'settings.general.fileAccessDenied');
  useEffect(() => {
    void getRecentUrls().then((urls) => setRecent(urls.slice(0, 5)));
  }, []);
  async function open(action: string, url?: string) {
    if (url && !isAllowedUrl(url)) {
      setError(t('settings.general.urlSchemeError'));
      return;
    }
    setError('');
    await browser.runtime.sendMessage({ action, url });
  }
  async function renderCurrent() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !isAllowedUrl(tab.url)) {
      setError(t('settings.general.pageUrlError'));
      return;
    }
    if (tab.url.startsWith('file:') && !(await browser.extension.isAllowedFileSchemeAccess())) {
      setFileAccessOpen(true);
      return;
    }
    await open('render-current', tab.url);
  }
  async function confirmReset() {
    try {
      await useSettingsStore.getState().reset();
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
    setResetOpen(false);
  }
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="popup-error">
          {error}
        </p>
      )}
      <div className="flex gap-1">
        <Button variant="ghost" className="popup-action" onClick={() => void open('open-viewer')}>
          <BookOpenIcon aria-hidden="true" />
          {t('settings.general.openViewer')}
        </Button>
        <Button variant="ghost" className="popup-action" onClick={() => void open('open-editor')}>
          <PencilIcon aria-hidden="true" />
          {t('settings.general.openEditor')}
        </Button>
        {showRenderCurrent && (
          <Button variant="ghost" className="popup-action" onClick={() => void renderCurrent()}>
            <GlobeIcon aria-hidden="true" />
            {t('settings.general.renderCurrent')}
          </Button>
        )}
      </div>
      <section aria-label={t('settings.general.recentUrls')} className="popup-recents">
        <h2 className="popup-recents-title">{t('settings.general.recent')}</h2>
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
          <p className="popup-empty">{t('settings.general.noRecent')}</p>
        )}
      </section>
      {toggle('enabled')}
      <SettingRow
        label={t('settings.general.fileAccess')}
        description={t('settings.general.fileAccessDescription')}
        labelId="general-fileAccess"
      >
        <Button
          variant="outline"
          aria-label={`${t('settings.general.fileAccess')}: ${fileAccessState}`}
          onClick={() => setFileAccessOpen(true)}
        >
          {fileAccessState}
        </Button>
      </SettingRow>
      <SettingRow label={t('settings.plugins.breaks')} description={t('settings.plugins.breaksDescription')} labelId="general-breaks">
        <Switch
          aria-labelledby="general-breaks"
          checked={breaks}
          onCheckedChange={(checked) => void save({ plugins: { breaks: checked } })}
        />
      </SettingRow>
      {toggle('outlineCollapsing')}
      {toggle('renderTxt')}
      {toggle('autoRefresh')}
      {toggle('autoRefreshRemote')}
      <SettingRow
        label={t('settings.general.autoRefreshInterval')}
        description={t('settings.general.autoRefreshIntervalDescription')}
        labelId="general-autoRefreshInterval"
      >
        <IntervalControl
          value={general.autoRefreshIntervalSec}
          onCommit={(autoRefreshIntervalSec) => void save({ general: { autoRefreshIntervalSec } })}
        />
      </SettingRow>
      {toggle('charsetCompat')}
      {toggle('showHiddenItems')}
      <IgnorePatternsControl value={general.ignorePatterns} onCommit={(ignorePatterns) => void save({ general: { ignorePatterns } })} />
      <SettingRow
        label={t('settings.general.language')}
        description={t('settings.general.languageDescription')}
        labelId="settings-language"
      >
        <Select value="en-US" items={languages} disabled>
          <SelectTrigger aria-labelledby="settings-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label={t('settings.general.reset')} description={t('settings.general.resetDescription')}>
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogTrigger render={<Button variant="outline" />}>{t('settings.general.reset')}</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.general.resetConfirmTitle')}</DialogTitle>
              <DialogDescription>{t('settings.general.resetConfirmBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(false)}>
                {t('settings.general.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => void confirmReset()}>
                {t('settings.general.resetConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SettingRow>
      <FileAccessDialog
        open={fileAccessOpen}
        onOpenChange={(open) => {
          setFileAccessOpen(open);
          if (!open) refreshFileAccess();
        }}
      />
    </div>
  );
}
