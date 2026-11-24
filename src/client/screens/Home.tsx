import { useState } from 'react';
import type { Level } from '../../shared/ai/search';
import { AVATAR_NAMES, AVATARS, AvatarKind } from '../../shared/protocol';
import { audio } from '../audio/audio';
import { Avatar } from '../components/Avatar';
import { IconBook, IconCpu, IconGlobe, IconSettings, IconUsers } from '../components/Icons';
import { SoundToggles } from '../components/SoundToggles';
import { setPrefs, usePrefs } from '../prefs';

export const LEVEL_INFO: Record<Level, { name: string; avatar: AvatarKind; who: string; note: string }> = {
  mudah: { name: 'Mudah', avatar: 'kancil', who: 'Si Kancil', note: 'kadang lupa makan' },
  sedang: { name: 'Sedang', avatar: 'orangutan', who: 'Pak Utan', note: 'berpikir beberapa langkah' },
  sulit: { name: 'Sulit', avatar: 'harimau', who: 'Raja Rimba', note: 'tak pernah lupa DAM' },
};

interface Props {
  inviteCode: string | null;
  busy: boolean;
  error: string | null;
  onCreateRoom: () => void;
  onJoin: (code: string) => void;
  onPlayAI: () => void;
  onPlayLocal: () => void;
  onRules: () => void;
  onRoomRules: () => void;
  onSettings: () => void;
}

export function Home(p: Props) {
  const prefs = usePrefs();
  const [code, setCode] = useState(p.inviteCode ?? '');

  return (
    <div className="screen home" onPointerDown={() => audio.unlock()}>
      <header className="topbar home-top">
        <div className="spacer" />
        <SoundToggles />
        <button className="icon-btn" aria-label="Pengaturan" onClick={p.onSettings}>
          <IconSettings />
        </button>
      </header>

      <div className="home-grid">
        <div className="brand">
          <svg width="76" height="48" viewBox="0 0 64 40" aria-hidden="true">
            <path d="M8 8H56V32H8Z M8 8 56 32 M56 8 8 32 M32 8V32 M8 20H56" stroke="#8A6A45" strokeWidth="2" fill="none" />
            <circle cx="8" cy="8" r="5" fill="#2D4F86" />
            <circle cx="32" cy="8" r="5" fill="#2D4F86" />
            <circle cx="56" cy="8" r="5" fill="#2D4F86" />
            <circle cx="8" cy="32" r="5" fill="#C8512A" />
            <circle cx="32" cy="32" r="5" fill="#C8512A" />
            <circle cx="56" cy="32" r="5" fill="#C8512A" />
          </svg>
          <h1>Dam-Daman</h1>
          <p>Permainan papan tradisional Indonesia</p>
        </div>

        <section className="card profile">
          <div className="row gap">
            <div className="avatar-ring red big">
              <Avatar kind={prefs.avatar} size={62} mood="happy" />
            </div>
            <div className="field grow">
              <label htmlFor="nama">Nama pemain</label>
              <input
                id="nama"
                value={prefs.name}
                maxLength={16}
                placeholder="Tulis namamu"
                autoComplete="nickname"
                onChange={(e) => setPrefs({ name: e.target.value })}
              />
            </div>
          </div>
          <div className="field-label">Pilih avatar · {AVATAR_NAMES[prefs.avatar]}</div>
          <div className="avatar-grid" role="radiogroup" aria-label="Pilih avatar">
            {AVATARS.map((a) => (
              <button
                key={a}
                role="radio"
                aria-checked={prefs.avatar === a}
                aria-label={AVATAR_NAMES[a]}
                className={`avatar-pick ${prefs.avatar === a ? 'on' : ''}`}
                onClick={() => {
                  audio.unlock();
                  audio.play('pop');
                  setPrefs({ avatar: a });
                }}
              >
                <Avatar kind={a} size={36} decorative />
              </button>
            ))}
          </div>
        </section>

        <section className={`card online ${p.inviteCode ? 'invited' : ''}`}>
          {p.inviteCode && <div className="invite-note">Kamu diundang ke room {p.inviteCode}</div>}
          <button className="btn red big" disabled={p.busy} onClick={p.onCreateRoom}>
            <IconGlobe /> Buat Room Online
          </button>
          <form
            className="row gap end"
            onSubmit={(e) => {
              e.preventDefault();
              p.onJoin(code);
            }}
          >
            <div className="field grow">
              <label htmlFor="kode">Punya kode dari teman?</label>
              <input
                id="kode"
                className="code-input"
                value={code}
                maxLength={5}
                placeholder="Contoh K7Q2X"
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
            </div>
            <button className={`btn ${p.inviteCode ? 'blue' : 'outline'}`} type="submit" disabled={p.busy || code.length < 5}>
              Gabung
            </button>
          </form>
          <button className="btn link small" onClick={p.onRoomRules}>
            Atur aturan room
          </button>
          {p.error && (
            <div className="error" role="alert">
              {p.error}
            </div>
          )}
        </section>

        <section className="card ai">
          <div className="row between">
            <h2>
              <IconCpu /> Lawan Komputer
            </h2>
            <span className="muted small">{LEVEL_INFO[prefs.level].note}</span>
          </div>
          <div className="level-grid" role="radiogroup" aria-label="Tingkat kesulitan">
            {(Object.keys(LEVEL_INFO) as Level[]).map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={prefs.level === l}
                className={`level ${prefs.level === l ? 'on' : ''}`}
                onClick={() => {
                  audio.unlock();
                  audio.play('select');
                  setPrefs({ level: l });
                }}
              >
                <Avatar kind={LEVEL_INFO[l].avatar} size={34} decorative />
                <span>{LEVEL_INFO[l].name}</span>
              </button>
            ))}
          </div>
          <button className="btn blue big" onClick={p.onPlayAI}>
            Main Lawan {LEVEL_INFO[prefs.level].who}
          </button>
          <button className="btn ghost" onClick={p.onPlayLocal}>
            <IconUsers /> Main Berdua di Satu Layar
          </button>
        </section>
      </div>

      <footer className="home-foot">
        <button className="btn link" onClick={p.onRules}>
          <IconBook width={16} height={16} /> Cara main dan aturan
        </button>
      </footer>
    </div>
  );
}
