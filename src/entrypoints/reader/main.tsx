/// <reference types="vite/client" />
import '../../lib/zod-config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyLanguage } from '../../i18n';
import { useSettingsStore } from '../../store/settings-store';
import App from './App';
import '../../styles/globals.css';
import '../../styles/popup.css';

export async function bootReader(container: HTMLElement): Promise<void> {
  try {
    await useSettingsStore.getState().load();
  } catch {
    // keep defaultSettings so the reader still renders
  }
  applyLanguage(useSettingsStore.getState().settings.general.language);
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Reader root element is missing');

void bootReader(root);
