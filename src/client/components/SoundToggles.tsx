import { audio } from '../audio/audio';
import { setPrefs, usePrefs } from '../prefs';
import { IconMusic, IconSound } from './Icons';

export function SoundToggles() {
  const prefs = usePrefs();
  return (
    <>
      <button
        className={`icon-btn ${prefs.musicOn ? '' : 'off'}`}
        aria-pressed={prefs.musicOn}
        aria-label={prefs.musicOn ? 'Matikan musik latar' : 'Nyalakan musik latar'}
        title="Musik latar"
        onClick={() => {
          audio.unlock();
          setPrefs({ musicOn: !prefs.musicOn });
        }}
      >
        <IconMusic off={!prefs.musicOn} />
      </button>
      <button
        className={`icon-btn ${prefs.sfxOn ? '' : 'off'}`}
        aria-pressed={prefs.sfxOn}
        aria-label={prefs.sfxOn ? 'Matikan efek suara' : 'Nyalakan efek suara'}
        title="Efek suara"
        onClick={() => {
          audio.unlock();
          setPrefs({ sfxOn: !prefs.sfxOn });
          if (!prefs.sfxOn) setTimeout(() => audio.play('pop'), 30);
        }}
      >
        <IconSound off={!prefs.sfxOn} />
      </button>
    </>
  );
}
