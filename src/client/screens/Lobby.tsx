import { useState } from 'react';
import type { RoomSnapshot } from '../../shared/protocol';
import { audio } from '../audio/audio';
import { Avatar } from '../components/Avatar';
import { IconBack, IconCopy, IconSettings, IconShare } from '../components/Icons';
import { RulesForm } from '../components/RulesForm';
import { SoundToggles } from '../components/SoundToggles';
import { online } from '../net/online';

export function Lobby({ snap, onLeave, onSettings }: { snap: RoomSnapshot; onLeave: () => void; onSettings: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isHost = snap.you === snap.host;
  const guest = snap.players.blue;
  const link = `${location.origin}/r/${snap.code}`;

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(done);
      audio.play('pop');
    } catch {
      setMsg('Tidak bisa menyalin otomatis. Salin manual ya.');
    }
    setTimeout(() => setMsg(null), 2200);
  };

  const share = async () => {
    const text = `Ayo main dam-daman! Kode room: ${snap.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Dam-Daman', text, url: link });
        return;
      } catch {
        /* dibatalkan */
      }
    }
    void copy(`${text}\n${link}`, 'Link undangan disalin');
  };

  const update = (patch: Partial<RoomSnapshot['settings']>) => {
    online.updateSettings({ ...snap.settings, ...patch }).catch((e: Error) => setErr(e.message));
  };

  return (
    <div className="screen lobby">
      <header className="topbar">
        <button className="icon-btn" aria-label="Keluar dari room" onClick={onLeave}>
          <IconBack />
        </button>
        <div className="topbar-title">Room Online</div>
        <SoundToggles />
        <button className="icon-btn" aria-label="Pengaturan" onClick={onSettings}>
          <IconSettings />
        </button>
      </header>

      <div className="lobby-grid">
        <section className="card code-card">
          <div className="muted">Bagikan kode ini ke temanmu</div>
          <div className="code-boxes" aria-label={`Kode room ${snap.code.split('').join(' ')}`}>
            {snap.code.split('').map((ch, i) => (
              <span key={i}>{ch}</span>
            ))}
          </div>
          <div className="row gap stretch">
            <button className="btn outline" onClick={() => copy(snap.code, 'Kode disalin')}>
              <IconCopy width={18} height={18} /> Salin kode
            </button>
            <button className="btn blue" onClick={share}>
              <IconShare width={18} height={18} /> Bagikan link
            </button>
          </div>
          <div className="muted small link-text">{link.replace(/^https?:\/\//, '')}</div>
          {msg && (
            <div className="toast-inline" role="status">
              {msg}
            </div>
          )}
        </section>

        <section className="versus">
          <div className="seat red">
            {snap.players.red && <Avatar kind={snap.players.red.avatar} size={72} mood="happy" />}
            <strong>{snap.players.red?.name}</strong>
            <span className="pill red">Merah · Host</span>
          </div>
          <div className="vs">VS</div>
          {guest ? (
            <div className="seat blue">
              <Avatar kind={guest.avatar} size={72} mood="happy" />
              <strong>{guest.name}</strong>
              <span className="pill blue">Biru{guest.connected ? '' : ' · terputus'}</span>
            </div>
          ) : (
            <div className="seat empty">
              <div className="waiting-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <strong>Menunggu lawan</strong>
              <span className="muted small">Biru</span>
            </div>
          )}
        </section>

        <section className="card">
          <div className="row between">
            <h2>Aturan room</h2>
            <span className="muted small">{isHost ? 'kamu host, bisa diubah' : 'diatur oleh host'}</span>
          </div>
          <RulesForm
            disabled={!isHost}
            rules={snap.settings.rules}
            onRules={(rules) => update({ rules })}
            turnSeconds={snap.settings.turnSeconds}
            onTurnSeconds={(turnSeconds) => update({ turnSeconds })}
            firstMove={snap.settings.firstMove}
            onFirstMove={(firstMove) => update({ firstMove })}
          />
          {err && (
            <div className="error" role="alert">
              {err}
            </div>
          )}
        </section>

        <div className="lobby-actions">
          {isHost ? (
            <>
              <button
                className="btn red big"
                disabled={!guest || !guest.connected}
                onClick={() => {
                  audio.unlock();
                  online.start().catch((e: Error) => setErr(e.message));
                }}
              >
                Mulai Main
              </button>
              {!guest && <span className="muted small">Tombol aktif setelah lawan bergabung</span>}
            </>
          ) : (
            <div className="waiting-host">Menunggu host memulai permainan...</div>
          )}
        </div>
      </div>
    </div>
  );
}
