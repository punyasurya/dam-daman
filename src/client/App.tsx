import { useCallback, useEffect, useRef, useState } from 'react';
import type { Level } from '../shared/ai/search';
import { Action, applyAction, Color, createGame, endGame, GameState, other } from '../shared/engine/rules';
import { askAI } from './ai/aiClient';
import { audio } from './audio/audio';
import { Modal } from './components/Modal';
import { RulesForm } from './components/RulesForm';
import { SettingsModal } from './components/SettingsModal';
import { online, useOnline } from './net/online';
import { getPrefs, loadToken, roomSettingsFromPrefs, setPrefs, usePrefs } from './prefs';
import { clearSavedGame, loadSavedGame, SavedGame, saveGame } from './session';
import { GameView } from './screens/GameView';
import { Home, LEVEL_INFO } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { RulesPage } from './screens/RulesPage';

type Screen =
  | { kind: 'home' }
  | { kind: 'rules' }
  | { kind: 'ai'; level: Level; restore?: SavedGame }
  | { kind: 'local'; restore?: SavedGame }
  | { kind: 'online' };

/** Layar pertama: lanjutkan permainan yang tersimpan kalau ada (kecuali membuka link undangan). */
function initialScreen(): Screen {
  if (inviteFromPath()) return { kind: 'home' };
  const saved = loadSavedGame();
  if (saved?.kind === 'ai') return { kind: 'ai', level: saved.level, restore: saved };
  if (saved?.kind === 'local') return { kind: 'local', restore: saved };
  return { kind: 'home' };
}

function inviteFromPath(): string | null {
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{5})\/?$/);
  return m ? m[1].toUpperCase() : null;
}

const playerName = () => getPrefs().name.trim() || 'Pemain';

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [invite, setInvite] = useState<string | null>(inviteFromPath);
  // Halaman dimuat ulang saat di room online: masuk lagi otomatis memakai token kursi yang tersimpan.
  const [resuming, setResuming] = useState(() => {
    const code = inviteFromPath();
    return !!code && !!loadToken(code);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roomRulesOpen, setRoomRulesOpen] = useState(false);
  const net = useOnline();
  const prefs = usePrefs();

  // URL mengikuti room yang sedang dibuka
  useEffect(() => {
    const code = screen.kind === 'online' ? net.snapshot?.code : null;
    const want = code ? `/r/${code}` : '/';
    if (location.pathname !== want && !(screen.kind === 'home' && invite)) history.replaceState(null, '', want);
  }, [screen.kind, net.snapshot?.code, invite]);

  useEffect(() => {
    if (!resuming || !invite) return;
    online
      .join(invite, playerName(), getPrefs().avatar)
      .then(() => {
        setInvite(null);
        setScreen({ kind: 'online' });
      })
      .catch(() => {
        /* room sudah tidak ada: tampilkan beranda dengan kode undangan */
      })
      .finally(() => setResuming(false));
    // hanya sekali saat halaman dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goHome = useCallback(() => {
    if (screen.kind === 'online') online.leave();
    if (screen.kind === 'ai' || screen.kind === 'local') clearSavedGame();
    setInvite(null);
    history.replaceState(null, '', '/');
    setScreen({ kind: 'home' });
  }, [screen.kind]);

  const createRoom = async () => {
    audio.unlock();
    setBusy(true);
    setError(null);
    try {
      await online.create(playerName(), prefs.avatar, roomSettingsFromPrefs(prefs));
      setScreen({ kind: 'online' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat room');
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (code: string) => {
    audio.unlock();
    setBusy(true);
    setError(null);
    try {
      await online.join(code, playerName(), prefs.avatar);
      setInvite(null);
      setScreen({ kind: 'online' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal bergabung');
    } finally {
      setBusy(false);
    }
  };

  let body: JSX.Element;
  if (resuming)
    body = (
      <div className="screen center">
        <div className="card narrow">
          <p>Menyambung lagi ke room {invite}...</p>
        </div>
      </div>
    );
  else if (screen.kind === 'rules') body = <RulesPage onBack={() => setScreen({ kind: 'home' })} />;
  else if (screen.kind === 'ai')
    body = <AIGame level={screen.level} restore={screen.restore} onExit={goHome} onSettings={() => setSettingsOpen(true)} />;
  else if (screen.kind === 'local') body = <LocalGame restore={screen.restore} onExit={goHome} onSettings={() => setSettingsOpen(true)} />;
  else if (screen.kind === 'online') {
    const snap = net.snapshot;
    if (!snap) {
      body = (
        <div className="screen center">
          <div className="card narrow">
            <p>{net.status === 'reconnecting' ? 'Menyambung ulang ke server...' : 'Room sudah tidak tersedia.'}</p>
            <button className="btn blue" onClick={goHome}>
              Kembali ke Beranda
            </button>
          </div>
        </div>
      );
    } else if (snap.phase === 'menunggu') body = <Lobby snap={snap} onLeave={goHome} onSettings={() => setSettingsOpen(true)} />;
    else body = <OnlineGame onExit={goHome} onSettings={() => setSettingsOpen(true)} />;
  } else
    body = (
      <Home
        inviteCode={invite}
        busy={busy}
        error={error}
        onCreateRoom={createRoom}
        onJoin={joinRoom}
        onPlayAI={() => {
          audio.unlock();
          setScreen({ kind: 'ai', level: prefs.level });
        }}
        onPlayLocal={() => {
          audio.unlock();
          setScreen({ kind: 'local' });
        }}
        onRules={() => setScreen({ kind: 'rules' })}
        onRoomRules={() => setRoomRulesOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />
    );

  return (
    <>
      {body}
      {screen.kind === 'online' && net.status === 'reconnecting' && net.snapshot && (
        <div className="conn-banner" role="status">
          Koneksi terputus, menyambung ulang...
        </div>
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {roomRulesOpen && (
        <Modal title="Aturan permainan" onClose={() => setRoomRulesOpen(false)}>
          <p className="muted small">Dipakai untuk room baru, lawan komputer, dan main berdua.</p>
          <RulesForm
            rules={prefs.rules}
            onRules={(rules) => setPrefs({ rules })}
            turnSeconds={prefs.turnSeconds}
            onTurnSeconds={(turnSeconds) => setPrefs({ turnSeconds })}
            firstMove={prefs.firstMove}
            onFirstMove={(firstMove) => setPrefs({ firstMove })}
          />
          <div className="row end">
            <button className="btn blue" onClick={() => setRoomRulesOpen(false)}>
              Simpan
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------- Lawan komputer ----------------

/** Skor, giliran pertama, dan penyimpanan otomatis yang sama untuk mode komputer dan berdua. */
function useSavedMatch(restore: SavedGame | undefined, save: (m: { game: GameState; first: Color; score: Record<Color, number> }) => void) {
  const [first, setFirst] = useState<Color>(restore?.first ?? 'red');
  const [game, setGame] = useState<GameState>(() => restore?.game ?? createGame(getPrefs().rules, 'red'));
  const [score, setScore] = useState<Record<Color, number>>(restore?.score ?? { red: 0, blue: 0 });
  // Hasil yang sudah dihitung ke skor (hasil dari permainan yang dipulihkan tidak dihitung lagi).
  const counted = useRef(game.result);
  useEffect(() => {
    const r = game.result;
    if (!r?.winner || r === counted.current) return;
    counted.current = r;
    setScore((s) => ({ ...s, [r.winner!]: s[r.winner!] + 1 }));
  }, [game.result]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => saveRef.current({ game, first, score }), [game, first, score]);
  const rematch = () => {
    const f = other(first);
    setFirst(f);
    setGame(createGame(getPrefs().rules, f));
  };
  return { game, setGame, score, rematch };
}

function AIGame({ level, restore, onExit, onSettings }: { level: Level; restore?: SavedGame; onExit: () => void; onSettings: () => void }) {
  const prefs = usePrefs();
  const human: Color = 'red';
  const ai = other(human);
  const { game, setGame, score, rematch } = useSavedMatch(restore, (m) => saveGame({ kind: 'ai', level, ...m }));
  const [thinking, setThinking] = useState(false);
  const gen = useRef(0);

  useEffect(() => {
    if (game.result || game.turn !== ai) return;
    const my = ++gen.current;
    setThinking(true);
    const lastSteps = game.last?.kind === 'move' ? game.last.move.path.length : 0;
    askAI(game, level, 650 + lastSteps * 240).then((action) => {
      if (gen.current !== my) return;
      setThinking(false);
      setGame((g) => (g === game ? applyAction(g, action) : g));
    });
    return () => {
      gen.current++;
      setThinking(false);
    };
  }, [game, ai, level, setGame]);

  const info = LEVEL_INFO[level];
  return (
    <GameView
      game={game}
      you={human}
      title={`Lawan ${info.who} · ${info.name}`}
      players={{
        red: { name: prefs.name.trim() || 'Kamu', avatar: prefs.avatar, kind: 'human' },
        blue: { name: info.who, avatar: info.avatar, kind: 'ai' },
      }}
      busy={thinking}
      score={score}
      onAction={(a: Action) => setGame((g) => applyAction(g, a))}
      onExit={onExit}
      onResign={() => setGame((g) => endGame(g, { winner: ai, reason: 'menyerah' }))}
      onRematch={rematch}
      onOpenSettings={onSettings}
    />
  );
}

// ---------------- Berdua di satu layar ----------------

function LocalGame({ restore, onExit, onSettings }: { restore?: SavedGame; onExit: () => void; onSettings: () => void }) {
  const prefs = usePrefs();
  const { game, setGame, score, rematch } = useSavedMatch(restore, (m) => saveGame({ kind: 'local', ...m }));
  const blueAvatar = prefs.avatar === 'komodo' ? 'jalak' : 'komodo';
  return (
    <GameView
      game={game}
      you="both"
      title="Main Berdua"
      players={{
        red: { name: prefs.name.trim() || 'Merah', avatar: prefs.avatar, kind: 'human' },
        blue: { name: 'Biru', avatar: blueAvatar, kind: 'human' },
      }}
      score={score}
      onAction={(a: Action) => setGame((g) => applyAction(g, a))}
      onExit={onExit}
      onResign={() => setGame((g) => endGame(g, { winner: other(g.turn), reason: 'menyerah' }))}
      onRematch={rematch}
      onOpenSettings={onSettings}
    />
  );
}

// ---------------- Online ----------------

function OnlineGame({ onExit, onSettings }: { onExit: () => void; onSettings: () => void }) {
  const net = useOnline();
  const snap = net.snapshot!;
  const game = snap.game!;
  const opp = other(snap.you);
  const p = (c: Color) => snap.players[c] ?? { name: c === 'red' ? 'Merah' : 'Biru', avatar: 'kucing' as const, connected: false };
  const myVote = snap.rematch[snap.you];
  const theirVote = snap.rematch[opp];
  return (
    <GameView
      game={game}
      you={snap.you}
      title={`Room ${snap.code}`}
      players={{
        red: { ...p('red'), kind: snap.you === 'red' ? 'human' : 'remote' },
        blue: { ...p('blue'), kind: snap.you === 'blue' ? 'human' : 'remote' },
      }}
      turnDeadline={snap.turnDeadline}
      clockOffset={net.clockOffset}
      score={snap.score}
      drawOffer={snap.drawOffer}
      emote={net.emote}
      canOfferDraw={snap.drawOffer === null}
      onAction={(a) => online.act(a)}
      onExit={onExit}
      onResign={() => void online.resign()}
      onOfferDraw={() => void online.offerDraw()}
      onAnswerDraw={(acc) => void online.answerDraw(acc)}
      onEmote={(i) => online.emote(i)}
      onRematch={() => void online.rematch()}
      rematchLabel={myVote ? 'Menunggu lawan...' : theirVote ? 'Terima Ajakan Main Lagi' : 'Main Lagi'}
      rematchNote={theirVote && !myVote ? `${p(opp).name} mengajak main lagi` : myVote && !theirVote ? 'Ajakan main lagi sudah dikirim' : undefined}
      onOpenSettings={onSettings}
    />
  );
}
