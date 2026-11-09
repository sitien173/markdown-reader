import { useState } from 'react';
import { Switch } from '../../components/ui/switch';
import { type I18nKey, useT } from '../../i18n';
import { defaultSettings, type Settings } from '../../lib/settings';
import { useSettingsStore } from '../../store/settings-store';
import { SettingRow } from './settings-panel';

type PluginName = keyof Settings['plugins'];
const pluginNames = Object.keys(defaultSettings.plugins) as PluginName[];

export function PluginsTab() {
  const t = useT();
  const plugins = useSettingsStore((s) => s.settings.plugins);
  const update = useSettingsStore((s) => s.update);
  const [error, setError] = useState('');
  const all = pluginNames.every((name) => plugins[name]);
  const save = (patch: Parameters<typeof update>[0]) =>
    update(patch).then(
      () => setError(''),
      (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
    );
  const setAll = (checked: boolean) =>
    save({ plugins: Object.fromEntries(pluginNames.map((name) => [name, checked])) as Settings['plugins'] });
  return (
    <div className="flex flex-col gap-1">
      {error && (
        <p role="alert" className="popup-error">
          {error}
        </p>
      )}
      <h2 className="text-lg font-semibold">{t('settings.tabs.plugins')}</h2>
      <SettingRow label={t('settings.plugins.all')} description={t('settings.plugins.allDescription')} labelId="plugin-all">
        <Switch aria-labelledby="plugin-all" checked={all} onCheckedChange={setAll} />
      </SettingRow>
      {pluginNames.map((name) => (
        <SettingRow
          key={name}
          label={t(`settings.plugins.${name}`)}
          description={t(`settings.plugins.${name}Description` as I18nKey)}
          labelId={`plugin-${name}`}
        >
          <Switch
            aria-labelledby={`plugin-${name}`}
            checked={plugins[name]}
            onCheckedChange={(checked) => void save({ plugins: { [name]: checked } })}
          />
        </SettingRow>
      ))}
    </div>
  );
}
