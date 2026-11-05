/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../../styles/globals.css';
import '../../styles/popup.css';

const root = document.getElementById('root');
if (!root) throw new Error('Popup root element is missing');
createRoot(root).render(<StrictMode><App /></StrictMode>);
