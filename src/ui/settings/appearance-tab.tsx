import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Slider } from '../../components/ui/slider';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { type I18nKey, useT } from '../../i18n';
import { clampMaxWidth } from '../../lib/appearance';
import { CUSTOM_CSS_MAX_LENGTH, type Settings } from '../../lib/settings';
import { validateCustomCss } from '../../lib/custom-css';
import { useSettingsStore } from '../../store/settings-store';
import { SettingRow } from './settings-panel';

type Appearance = Settings['appearance'];

function OptionSelect<Value extends string>({
  labelId,
  value,
  options,
  onChange,
}: {
  labelId: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <Select value={value} items={options} onValueChange={(next) => next && onChange(next as Value)}>
      <SelectTrigger aria-labelledby={labelId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AppearanceTab() {
  const t = useT();
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const update = useSettingsStore((s) => s.update);
  const [error, setError] = useState('');
  const [textSizeDraft, setTextSizeDraft] = useState<number | null>(null);
  const save = (patch: Partial<Appearance>) =>
    update({ appearance: patch }).then(
      () => setError(''),
      (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
    );
  const row = (key: string) => ({
    label: t(`settings.appearance.${key}` as I18nKey),
    description: t(`settings.appearance.${key}Description` as I18nKey),
    labelId: `appearance-${key}`,
  });
  const codeOptions = [
    { value: 'light' as const, label: t('settings.appearance.codeLight') },
    { value: 'dark' as const, label: t('settings.appearance.codeDark') },
  ];
  const fonts = [
    { value: 'default' as const, label: t('settings.appearance.fontDefault') },
    { value: 'serif' as const, label: t('settings.appearance.fontSerif') },
    { value: 'sans' as const, label: t('settings.appearance.fontSans') },
    { value: 'mono' as const, label: t('settings.appearance.fontMono') },
  ];
  const themes = [
    { value: 'auto' as const, label: t('settings.appearance.themeAuto') },
    { value: 'light' as const, label: t('settings.appearance.themeLight') },
    { value: 'dark' as const, label: t('settings.appearance.themeDark') },
  ];
  const toggles = [
    ['wrapCode', 'wrapCode'],
    ['wideTables', 'wideTables'],
    ['zen', 'zen'],
    ['centered', 'centered'],
  ] as const;
  return (
    <div className="flex flex-col gap-1">
      {error && (
        <p role="alert" className="popup-error">
          {error}
        </p>
      )}
      <h2 className="text-lg font-semibold">{t('settings.tabs.appearance')}</h2>
      <SettingRow {...row('textSize')}>
        <div className="w-32">
          <Slider
            aria-labelledby="appearance-textSize"
            min={1}
            max={6}
            step={1}
            value={[textSizeDraft ?? appearance.textSize]}
            onValueChange={(value) => setTextSizeDraft([value].flat()[0] ?? null)}
            onValueCommitted={(value) => {
              setTextSizeDraft(null);
              void save({ textSize: [value].flat()[0] });
            }}
          />
        </div>
      </SettingRow>
      <SettingRow {...row('font')}>
        <OptionSelect labelId="appearance-font" value={appearance.font} options={fonts} onChange={(font) => void save({ font })} />
      </SettingRow>
      <SettingRow {...row('theme')}>
        <OptionSelect labelId="appearance-theme" value={appearance.theme} options={themes} onChange={(theme) => void save({ theme })} />
      </SettingRow>
      <SettingRow {...row('codeThemeLight')}>
        <OptionSelect
          labelId="appearance-codeThemeLight"
          value={appearance.codeThemeLight}
          options={codeOptions}
          onChange={(codeThemeLight) => void save({ codeThemeLight })}
        />
      </SettingRow>
      <SettingRow {...row('codeThemeDark')}>
        <OptionSelect
          labelId="appearance-codeThemeDark"
          value={appearance.codeThemeDark}
          options={codeOptions}
          onChange={(codeThemeDark) => void save({ codeThemeDark })}
        />
      </SettingRow>
      {toggles.map(([name, key]) => (
        <SettingRow key={name} {...row(key)}>
          <Switch
            aria-labelledby={`appearance-${key}`}
            checked={appearance[name]}
            onCheckedChange={(checked) => void save({ [name]: checked })}
          />
        </SettingRow>
      ))}
      <SettingRow {...row('customMaxWidth')}>
        <Switch
          aria-labelledby="appearance-customMaxWidth"
          checked={appearance.customMaxWidth}
          onCheckedChange={(customMaxWidth) => void save({ customMaxWidth })}
        />
      </SettingRow>
      {appearance.customMaxWidth && <MaxWidthControls value={appearance.maxWidthPx} onCommit={(maxWidthPx) => void save({ maxWidthPx })} />}
      <CustomCss appearance={appearance} save={save} />
    </div>
  );
}

function MaxWidthControls({ value, onCommit }: { value: number; onCommit: (px: number) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(String(value));
  const [synced, setSynced] = useState(value);
  const [sliderDraft, setSliderDraft] = useState<number | null>(null);
  if (value !== synced) {
    setSynced(value);
    setDraft(String(value));
  }
  const commit = () => {
    const px = clampMaxWidth(Number(draft));
    setDraft(String(px));
    if (px !== value) onCommit(px);
  };
  return (
    <div className="flex items-center justify-end gap-3 py-1">
      <div className="w-40">
        <span id="appearance-maxWidthSlider" className="sr-only">
          {t('settings.appearance.maxWidthSlider')}
        </span>
        <Slider
          aria-labelledby="appearance-maxWidthSlider"
          min={500}
          max={3000}
          step={50}
          value={[sliderDraft ?? value]}
          onValueChange={(next) => setSliderDraft([next].flat()[0] ?? null)}
          onValueCommitted={(next) => {
            setSliderDraft(null);
            onCommit([next].flat()[0] ?? value);
          }}
        />
      </div>
      <Input
        type="number"
        className="w-20"
        aria-label={t('settings.appearance.maxWidthField')}
        min={500}
        max={3000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </div>
  );
}

function CustomCss({ appearance, save }: { appearance: Appearance; save: (patch: Partial<Appearance>) => Promise<void> }) {
  const t = useT();
  const stored = appearance.customCss;
  const [draft, setDraft] = useState(stored);
  const [synced, setSynced] = useState(stored);
  const [message, setMessage] = useState('');
  // An unedited draft follows the stored value, so a change from another context shows up; an edited draft is kept.
  if (stored !== synced) {
    setSynced(stored);
    if (draft === synced) setDraft(stored);
  }
  const apply = () => {
    const result = validateCustomCss(draft);
    if (!result.ok) {
      // The stored value, and so the applied stylesheet, stays as it was.
      setMessage(result.message);
      return;
    }
    setMessage('');
    void save({ customCss: draft });
  };
  return (
    <div className="flex flex-col gap-2 py-2">
      <SettingRow
        label={t('settings.appearance.customCss')}
        description={t('settings.appearance.customCssDescription')}
        labelId="appearance-customCss"
      >
        <Switch
          aria-labelledby="appearance-customCss"
          checked={appearance.customCssEnabled}
          onCheckedChange={(customCssEnabled) => void save({ customCssEnabled })}
        />
      </SettingRow>
      <Textarea
        aria-label={t('settings.appearance.customCssField')}
        aria-invalid={message ? true : undefined}
        spellCheck={false}
        maxLength={CUSTOM_CSS_MAX_LENGTH}
        className="font-mono"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {message && (
        <p role="alert" className="popup-error">
          {message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setDraft(stored);
            setMessage('');
          }}
        >
          {t('settings.appearance.customCssCancel')}
        </Button>
        <Button onClick={apply}>{t('settings.appearance.customCssApply')}</Button>
      </div>
    </div>
  );
}
