import { SettingsPanel } from '../../ui/settings/settings-panel';

export default function App() {
  return (
    <main className="mx-auto my-8 flex h-[480px] w-[520px] max-w-full overflow-hidden rounded-xl border bg-background text-foreground">
      <SettingsPanel />
    </main>
  );
}
