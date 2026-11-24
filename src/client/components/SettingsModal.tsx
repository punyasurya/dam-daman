import { audio } from '../audio/audio';
import { setPrefs, usePrefs } from '../prefs';
import { Modal } from './Modal';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const p = usePrefs();
  return (
    <Modal title="Pengaturan" onClose={onClose}>
      <div className="settings">
        <label className="switch-row">
          <span>Musik latar gamelan</span>
          <input type="checkbox" checked={p.musicOn} onChange={(e) => (audio.unlock(), setPrefs({ musicOn: e.target.checked }))} />
        </label>
        <label className="slider-row">
          <span>Volume musik</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={p.musicVolume}
            disabled={!p.musicOn}
            onChange={(e) => setPrefs({ musicVolume: Number(e.target.value) })}
          />
        </label>
        <label className="switch-row">
          <span>Efek suara</span>
          <input type="checkbox" checked={p.sfxOn} onChange={(e) => (audio.unlock(), setPrefs({ sfxOn: e.target.checked }))} />
        </label>
        <label className="slider-row">
          <span>Volume efek</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={p.sfxVolume}
            disabled={!p.sfxOn}
            onChange={(e) => setPrefs({ sfxVolume: Number(e.target.value) })}
            onPointerUp={() => audio.play('capture')}
            onKeyUp={() => audio.play('capture')}
          />
        </label>
        <label className="switch-row">
          <span>Getar saat makan (HP)</span>
          <input type="checkbox" checked={p.vibrate} onChange={(e) => setPrefs({ vibrate: e.target.checked })} />
        </label>
        <p className="muted small">Semua musik dan suara dibuat langsung oleh game ini, bukan rekaman.</p>
      </div>
    </Modal>
  );
}
