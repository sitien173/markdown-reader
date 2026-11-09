import { useT } from '../../i18n';

export function AboutTab() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <img src="/icons/icon-128.png" width={128} height={128} alt="" />
      <h1 className="text-xl font-semibold">{t('settings.about.name')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('settings.about.version')} {browser.runtime.getManifest().version}
      </p>
      <p className="text-xs text-muted-foreground">{t('settings.about.copyright')}</p>
    </div>
  );
}
