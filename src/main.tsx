import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// David should sound close and calm, never like a loud media player. Some
// screens create their own HTMLAudioElement, so enforce one web playback ceiling
// here instead of letting a missed per-screen volume setting make him shout.
if (typeof HTMLMediaElement !== 'undefined') {
  const volumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');

  if (volumeDescriptor?.get && volumeDescriptor?.set) {
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
      configurable: volumeDescriptor.configurable,
      enumerable: volumeDescriptor.enumerable,
      get: volumeDescriptor.get,
      set(value: number) {
        volumeDescriptor.set?.call(this, Math.max(0, Math.min(0.55, value)));
      },
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
