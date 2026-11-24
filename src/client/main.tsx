import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { audio } from './audio/audio';
import './styles.css';

// Browser hanya mengizinkan suara setelah interaksi pertama.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
