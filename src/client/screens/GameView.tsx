import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Action,
  Color,
  countPieces,
  damTargetCount,
  GameState,
  legalMoves,
  Move,
  other,
} from '../../shared/engine/rules';
import { AvatarKind, EMOTES } from '../../shared/protocol';
import { audio } from '../audio/audio';
import { Avatar, AvatarMood } from '../components/Avatar';
import { Board } from '../components/Board';
import { IconBack, IconChat, IconFlag, IconHandshake, IconSettings } from '../components/Icons';
import { Confirm } from '../components/Modal';
import { SoundToggles } from '../components/SoundToggles';
import type { EmoteEvent } from '../net/online';

export interface SideInfo {
  name: string;
  avatar: AvatarKind;
  kind: 'human' | 'ai' | 'remote';
  connected?: boolean;
  note?: string;
}

export interface GameViewProps {
  game: GameState;
  /** Warna pemain di perangkat ini. 'both' = dua pemain satu layar. */
  you: Color | 'both';
  players: Record<Color, SideInfo>;
  title: string;
  busy?: boolean;
  turnDeadline?: number | null;
  clockOffset?: number;
  score?: Record<Color, number>;
  drawOffer?: Color | null;
  emote?: EmoteEvent | null;
  canOfferDraw?: boolean;
  onAction: (a: Action) => Promise<void> | void;
  onExit: () => void;
  onResign: () => void;
  onOfferDraw?: () => void;
  onAnswerDraw?: (accept: boolean) => void;
  onEmote?: (index: number) => void;
  onRematch: () => void;
  rematchLabel?: string;
  rematchNote?: string;
  onOpenSettings: () => void;
}

const COLOR_NAME: Record<Color, string> = { red: 'Merah', blue: 'Biru' };

const REASON_TEXT: Record<string, (w: string, l: string) => string> = {
  habis: (w, l) => `Semua bidak ${l} sudah habis dimakan ${w}.`,
  buntu: (_w, l) => `${l} tidak punya langkah lagi.`,
  menyerah: (_w, l) => `${l} menyerah.`,
  waktu: (_w, l) => `${l} kehabisan waktu 3 kali berturut-turut.`,
  terputus: (_w, l) => `${l} terputus terlalu lama.`,
  'seri-langkah': () => 'Sudah 50 langkah tiap pemain tanpa ada yang makan.',
  'seri-ulang': () => 'Posisi yang sama terulang tiga kali.',
  'seri-sepakat': () => 'Kedua pemain sepakat seri.',
};

function startsWith(path: readonly number[], prefix: readonly number[]) {
  return prefix.every((p, i) => path[i] === p);
}

export function GameView(props: GameViewProps) {
  const { game, you, players, busy } = props;
  const [selected, setSelected] = useState<number | null>(null);
  const [partial, setPartial] = useState<number[]>([]);
  const [damMode, setDamMode] = useState(false);
  const [damChosen, setDamChosen] = useState<number[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: string; key: number } | null>(null);
  const [moods, setMoods] = useState<Record<Color, AvatarMood>>({ red: 'idle', blue: 'idle' });
  const [animating, setAnimating] = useState(false);
  const [confirm, setConfirm] = useState<null | 'resign' | 'exit'>(null);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Record<Color, string | null>>({ red: null, blue: null });
  const [showResult, setShowResult] = useState(false);
  const [now, setNow] = useState(Date.now());
  const sending = useRef(false);

  const flip = you === 'blue';
  const bottom: Color = you === 'blue' ? 'blue' : 'red';
  const top = other(bottom);
  const localTurn = !game.result && !busy && (you === 'both' || game.turn === you) && players[game.turn].kind === 'human';
  const moves = useMemo(() => (localTurn ? legalMoves(game) : []), [game, localTurn]);
  const needDam = localTurn ? damTargetCount(game) : 0;

  // Reset pilihan setiap kali posisi berubah
  useEffect(() => {
    setSelected(null);
    setPartial([]);
    setDamMode(false);
    setDamChosen([]);
    sending.current = false;
  }, [game]);

  const flash = useCallback((text: string, tone = 'info') => setToast({ text, tone, key: Date.now() + Math.random() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const moodFor = useCallback((c: Color, m: AvatarMood, ms = 1400) => {
    setMoods((prev) => ({ ...prev, [c]: m }));
    setTimeout(() => setMoods((prev) => (prev[c] === m ? { ...prev, [c]: 'idle' } : prev)), ms);
  }, []);

  // Reaksi terhadap aksi terakhir
  const lastSeen = useRef(game.last);
  useEffect(() => {
    const last = game.last;
    if (last === lastSeen.current) return;
    lastSeen.current = last;
    if (!last) return;
    if (last.kind === 'dam') {
      audio.play('dam');
      flash(`DAM! ${players[last.by].name} mengambil ${last.targets.length} bidak ${COLOR_NAME[other(last.by)]}.`, 'dam');
      moodFor(last.by, 'happy');
      moodFor(other(last.by), 'sad');
    } else {
      setAnimating(true);
    }
  }, [game, players, flash, moodFor]);

  const onAnimDone = useCallback(() => {
    setAnimating(false);
    const last = game.last;
    if (!last || last.kind !== 'move') return;
    const n = last.move.captures.length;
    if (n >= 2) flash(`Ngeracik! ${players[last.by].name} makan ${n} bidak sekaligus.`, 'good');
    if (n > 0) {
      moodFor(last.by, 'happy');
      moodFor(other(last.by), 'sad');
    }
    if (last.promoted) {
      audio.play('promote');
      flash(`${players[last.by].name} punya raja baru!`, 'good');
    }
    if (last.lalai && !game.result) {
      const claimant = other(last.by);
      const claimantLocal = players[claimant].kind === 'human' && (you === 'both' || you === claimant);
      if (claimantLocal) {
        audio.play('lalai');
        flash(`${players[last.by].name} lupa makan! Teriak DAM sekarang.`, 'dam');
      } else if (players[last.by].kind === 'human') {
        flash('Kamu lupa makan! Lawan bisa teriak DAM.', 'warn');
      }
    }
    if (!game.result && players[game.turn].kind === 'human' && you !== 'both' && game.turn === you) audio.play('turn');
  }, [game, players, you, flash, moodFor]);

  // Hasil akhir
  useEffect(() => {
    if (!game.result) {
      setShowResult(false);
      return;
    }
    const t = setTimeout(
      () => {
        setShowResult(true);
        const w = game.result!.winner;
        if (!w) audio.play('draw');
        else if (you === 'both' || you === w) audio.play('win');
        else audio.play('lose');
        if (w) {
          setMoods({ red: w === 'red' ? 'happy' : 'sad', blue: w === 'blue' ? 'happy' : 'sad' });
        }
      },
      game.last?.kind === 'move' ? 900 : 300,
    );
    return () => clearTimeout(t);
  }, [game.result, game.last, players, you]);

  // Emote masuk
  useEffect(() => {
    const e = props.emote;
    if (!e) return;
    audio.play('pop');
    setBubbles((b) => ({ ...b, [e.from]: EMOTES[e.index] }));
    const t = setTimeout(() => setBubbles((b) => ({ ...b, [e.from]: null })), 2800);
    return () => clearTimeout(t);
  }, [props.emote]);

  // Jam giliran
  useEffect(() => {
    if (!props.turnDeadline || game.result) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [props.turnDeadline, game.result]);
  const remaining = props.turnDeadline ? Math.max(0, Math.ceil((props.turnDeadline - (now + (props.clockOffset ?? 0))) / 1000)) : null;
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (remaining === null || !localTurn) return;
    if (remaining <= 10 && remaining > 0 && remaining !== lastTick.current) audio.play('tick');
    lastTick.current = remaining;
  }, [remaining, localTurn]);

  // ---------- Interaksi papan ----------

  const selectable = useMemo(() => {
    if (!localTurn || damMode || partial.length > 0) return new Set<number>();
    return new Set(moves.map((m) => m.from));
  }, [moves, localTurn, damMode, partial]);

  const mustCapture = useMemo(() => {
    if (!localTurn || game.settings.mode !== 'wajib') return new Set<number>();
    return new Set(moves.filter((m) => m.captures.length > 0).map((m) => m.from));
  }, [moves, localTurn, game.settings.mode]);

  const candidates: Move[] = useMemo(
    () => (selected === null ? [] : moves.filter((m) => m.from === selected && startsWith(m.path, partial))),
    [moves, selected, partial],
  );
  const nextTargets = useMemo(() => {
    const s = new Set<number>();
    for (const m of candidates) if (m.path.length > partial.length) s.add(m.path[partial.length]);
    return s;
  }, [candidates, partial]);
  const captureTargets = useMemo(() => {
    const s = new Set<number>();
    for (const m of candidates) if (m.captures.length > partial.length) s.add(m.path[partial.length]);
    return s;
  }, [candidates, partial]);
  const marked = useMemo(() => {
    const m = candidates[0];
    return new Set(m ? m.captures.slice(0, partial.length) : []);
  }, [candidates, partial]);
  const exactStop = partial.length > 0 ? candidates.find((m) => m.path.length === partial.length) : undefined;
  const canContinue = partial.length > 0 && nextTargets.size > 0;

  const damCandidates = useMemo(() => {
    if (!damMode) return new Set<number>();
    const opp = other(game.turn);
    const s = new Set<number>();
    game.board.forEach((c, i) => c && c.color === opp && s.add(i));
    return s;
  }, [damMode, game]);

  const send = useCallback(
    async (a: Action) => {
      if (sending.current) return;
      sending.current = true;
      try {
        await props.onAction(a);
      } catch (e) {
        sending.current = false;
        audio.play('invalid');
        flash(e instanceof Error ? e.message : 'Langkah ditolak', 'warn');
      }
    },
    [props, flash],
  );

  const commit = (m: Move) => {
    void send({ type: 'move', from: m.from, path: m.path });
  };

  const onPoint = (p: number) => {
    audio.unlock();
    if (!localTurn || animating) return;
    if (damMode) {
      if (!damCandidates.has(p)) return;
      audio.play('select');
      setDamChosen((ch) => (ch.includes(p) ? ch.filter((x) => x !== p) : ch.length < needDam ? [...ch, p] : ch));
      return;
    }
    if (nextTargets.has(p)) {
      const np = [...partial, p];
      const cands = candidates.filter((m) => startsWith(m.path, np));
      const exact = cands.find((m) => m.path.length === np.length);
      const longer = cands.some((m) => m.path.length > np.length);
      if (exact && !longer) {
        commit(exact);
      } else {
        audio.play(captureTargets.has(p) ? 'capture' : 'select');
        setPartial(np);
      }
      return;
    }
    if (partial.length === 0 && selectable.has(p)) {
      if (selected === p) {
        setSelected(null);
        return;
      }
      audio.play('select');
      setSelected(p);
      return;
    }
    if (partial.length === 0) {
      const cell = game.board[p];
      if (cell && cell.color === game.turn) {
        audio.play('invalid');
        flash(cell.raja ? 'Raja ini tidak punya langkah.' : 'Bidak ini tidak bisa jalan. Bidak biasa tidak boleh mundur.', 'warn');
      }
      setSelected(null);
    }
  };

  // ---------- Tampilan ----------

  const result = game.result;
  const winnerName = result?.winner ? players[result.winner].name : '';
  const loserName = result?.winner ? players[other(result.winner)].name : '';
  const youWon = !!result?.winner && (you === 'both' || you === result.winner);
  const resultTitle = !result
    ? ''
    : !result.winner
      ? 'Seri!'
      : you === 'both'
        ? `${winnerName} Menang!`
        : youWon
          ? 'Kamu Menang!'
          : 'Kamu Kalah';

  const playerBar = (c: Color, pos: 'top' | 'bottom') => {
    const info = players[c];
    const active = !result && game.turn === c;
    const thinking = active && info.kind === 'ai' && busy;
    const mood: AvatarMood = thinking ? 'think' : moods[c];
    const pieces = countPieces(game.board, c);
    return (
      <div className={`player-bar ${pos} ${c} ${active ? 'active' : ''}`}>
        <div className={`avatar-ring ${c}`}>
          <Avatar kind={info.avatar} size={46} mood={mood} />
          {bubbles[c] && <div className="bubble">{bubbles[c]}</div>}
        </div>
        <div className="player-meta">
          <div className="player-name">
            {info.name}
            {you !== 'both' && c === you && <span className="you-tag">kamu</span>}
            {info.kind === 'remote' && info.connected === false && <span className="dc-tag">terputus</span>}
          </div>
          <div className={`player-sub ${c}`}>
            {COLOR_NAME[c]} · {pieces} bidak{info.note ? ` · ${info.note}` : ''}
            {props.score && ` · menang ${props.score[c]}`}
          </div>
        </div>
        <div className="player-status">
          {active && remaining !== null ? (
            <span className={`clock ${remaining <= 10 ? 'low' : ''}`}>
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </span>
          ) : thinking ? (
            <span className="thinking">
              berpikir<span className="dots" />
            </span>
          ) : active ? (
            <span className="turn-tag">giliran</span>
          ) : null}
        </div>
      </div>
    );
  };

  let banner: JSX.Element | null = null;
  if (localTurn && damMode) {
    banner = (
      <div className="banner dam">
        <div className="banner-text">
          <strong>Pilih {needDam} bidak lawan</strong>
          <span>
            {damChosen.length} dari {needDam} dipilih
          </span>
        </div>
        <button className="btn ghost small" onClick={() => (setDamMode(false), setDamChosen([]))}>
          Batal
        </button>
        <button
          className="btn gold small"
          disabled={damChosen.length !== needDam}
          onClick={() => void send({ type: 'dam', targets: damChosen })}
        >
          Ambil
        </button>
      </div>
    );
  } else if (localTurn && needDam > 0) {
    banner = (
      <div className="banner dam">
        <div className="banner-text">
          <strong>{players[other(game.turn)].name} lupa makan!</strong>
          <span>Teriak DAM untuk ambil {needDam} bidaknya, atau langsung jalan.</span>
        </div>
        <button
          className="btn gold dam-btn"
          onClick={() => {
            audio.play('select');
            setSelected(null);
            setPartial([]);
            setDamMode(true);
          }}
        >
          DAM!
        </button>
      </div>
    );
  } else if (localTurn && partial.length > 0) {
    banner = (
      <div className="banner chain">
        <div className="banner-text">
          <strong>Ngeracik!</strong>
          <span>{canContinue ? 'Lompat lagi ke titik yang ditandai.' : 'Selesai.'}</span>
        </div>
        <button className="btn ghost small" onClick={() => (setPartial([]), setSelected(null))}>
          Ulangi
        </button>
        {exactStop && canContinue && (
          <button className="btn small" onClick={() => commit(exactStop)} title="Berhenti sebelum makan semua bisa kena DAM">
            Berhenti
          </button>
        )}
      </div>
    );
  } else if (props.drawOffer && you !== 'both' && props.drawOffer !== you && !result) {
    banner = (
      <div className="banner info">
        <div className="banner-text">
          <strong>{players[props.drawOffer].name} menawarkan seri</strong>
        </div>
        <button className="btn ghost small" onClick={() => props.onAnswerDraw?.(false)}>
          Tolak
        </button>
        <button className="btn blue small" onClick={() => props.onAnswerDraw?.(true)}>
          Terima
        </button>
      </div>
    );
  } else if (!result) {
    const turnName = players[game.turn].name;
    const text =
      you === 'both'
        ? `Giliran ${turnName} (${COLOR_NAME[game.turn]})`
        : game.turn === you
          ? selected === null
            ? 'Giliranmu. Pilih bidak yang mau dijalankan.'
            : 'Pilih titik tujuan.'
          : `Menunggu ${turnName}...`;
    banner = (
      <div className="banner plain">
        <div className="banner-text">
          <span>{text}</span>
        </div>
      </div>
    );
  }

  const myStats = result ? (you === 'both' ? (result.winner ?? 'red') : you) : 'red';
  const hero: Color = you === 'both' ? (result?.winner ?? 'red') : you;
  const heroWon = !!result?.winner && result.winner === hero;

  return (
    <div className="screen game-screen">
      <header className="topbar">
        <button className="icon-btn" aria-label="Keluar ke beranda" onClick={() => (result ? props.onExit() : setConfirm('exit'))}>
          <IconBack />
        </button>
        <div className="topbar-title">{props.title}</div>
        <SoundToggles />
        <button className="icon-btn" aria-label="Pengaturan" onClick={props.onOpenSettings}>
          <IconSettings />
        </button>
      </header>

      <div className="game-layout">
        <div className="game-col">
          {playerBar(top, 'top')}
          <div className="board-wrap">
            <Board
              game={game}
              flip={flip}
              selectable={selectable}
              mustCapture={mustCapture}
              selected={selected}
              partialPath={partial}
              targets={localTurn && !damMode ? nextTargets : undefined}
              captureTargets={captureTargets}
              marked={marked}
              damCandidates={damCandidates}
              damChosen={new Set(damChosen)}
              onPoint={onPoint}
              onStep={(kind, i) => audio.play(kind === 'capture' ? 'capture' : 'move', { chain: i })}
              onAnimDone={onAnimDone}
              label={`Papan dam-daman. Giliran ${COLOR_NAME[game.turn]}.`}
            />
            {toast && (
              <div key={toast.key} className={`toast ${toast.tone}`} role="status" aria-live="polite">
                {toast.text}
              </div>
            )}
          </div>
          {playerBar(bottom, 'bottom')}
        </div>

        <aside className="game-side">
          <div className="banner-slot" aria-live="polite">
            {banner}
          </div>
          <div className="side-actions">
            {props.onEmote && (
              <div className="emote-wrap">
                <button className="btn ghost small" onClick={() => setEmoteOpen((o) => !o)} aria-expanded={emoteOpen}>
                  <IconChat width={16} height={16} /> Emote
                </button>
                {emoteOpen && (
                  <div className="emote-menu">
                    {EMOTES.map((e, i) => (
                      <button
                        key={e}
                        className="btn ghost small"
                        onClick={() => {
                          props.onEmote?.(i);
                          setEmoteOpen(false);
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {props.onOfferDraw && (
              <button
                className="btn ghost small"
                disabled={!!result || !props.canOfferDraw}
                onClick={() => {
                  props.onOfferDraw?.();
                  flash('Tawaran seri dikirim.');
                }}
              >
                <IconHandshake width={16} height={16} /> Tawar seri
              </button>
            )}
            <button className="btn ghost small" disabled={!!result} onClick={() => setConfirm('resign')}>
              <IconFlag width={16} height={16} /> Menyerah
            </button>
          </div>
          <div className="rule-chip">
            {game.settings.mode === 'tradisional' ? `Tradisional · DAM ${game.settings.damPenalty} bidak` : 'Wajib makan'} ·{' '}
            {game.settings.raja === 'terbang' ? 'raja terbang' : game.settings.raja === 'ganjil' ? 'raja langkah ganjil' : 'tanpa raja'}
          </div>
        </aside>
      </div>

      {showResult && result && (
        <div className="result-overlay">
          <div className="result-card">
            {heroWon && <div className="confetti" aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.15}s` }} className={`c${i % 4}`} />
              ))}
            </div>}
            <div className="result-avatar">
              {heroWon && (
                <svg className="result-crown" width="72" height="40" viewBox="0 0 72 40" aria-hidden="true">
                  <path d="M6 36L10 8L24 22L36 4L48 22L62 8L66 36Z" fill="#E0A526" stroke="#A87A12" strokeWidth="2.5" strokeLinejoin="round" />
                  <circle cx="36" cy="26" r="4" fill="#C8512A" />
                </svg>
              )}
              <div className={`result-face ${heroWon ? '' : 'plain'}`}>
                <Avatar kind={players[hero].avatar} size={120} mood={heroWon ? 'happy' : result.winner ? 'sad' : 'idle'} />
              </div>
            </div>
            <h2 className={`result-title ${result.winner ? (youWon ? 'win' : 'lose') : 'draw'}`}>{resultTitle}</h2>
            <p className="result-reason">{REASON_TEXT[result.reason]?.(winnerName, loserName)}</p>
            <div className="stats">
              <div>
                <span>Bidak dimakan</span>
                <strong>{game.stats[myStats].captured}</strong>
              </div>
              <div>
                <span>Ngeracik terpanjang</span>
                <strong>{game.stats[myStats].longestChain}</strong>
              </div>
              <div>
                <span>DAM berhasil</span>
                <strong>{game.stats[myStats].dams}</strong>
              </div>
              <div>
                <span>Total langkah</span>
                <strong>{game.plies}</strong>
              </div>
            </div>
            {props.rematchNote && <div className="rematch-note">{props.rematchNote}</div>}
            <div className="result-actions">
              <button className="btn red big" onClick={props.onRematch}>
                {props.rematchLabel ?? 'Main Lagi'}
              </button>
              <button className="btn ghost" onClick={props.onExit}>
                Kembali ke Beranda
              </button>
              <button className="btn link" onClick={() => setShowResult(false)}>
                Lihat papan
              </button>
            </div>
          </div>
        </div>
      )}
      {result && !showResult && (
        <button className="btn red floating" onClick={() => setShowResult(true)}>
          Lihat hasil
        </button>
      )}

      {confirm === 'resign' && (
        <Confirm
          title="Menyerah?"
          text="Lawan akan dinyatakan menang."
          yes="Ya, menyerah"
          danger
          onNo={() => setConfirm(null)}
          onYes={() => {
            setConfirm(null);
            props.onResign();
          }}
        />
      )}
      {confirm === 'exit' && (
        <Confirm
          title="Keluar dari permainan?"
          text={players[other(bottom)].kind === 'remote' ? 'Kalau tidak kembali dalam 2 menit, kamu dianggap kalah.' : 'Permainan ini tidak akan disimpan.'}
          yes="Keluar"
          danger
          onNo={() => setConfirm(null)}
          onYes={() => {
            setConfirm(null);
            props.onExit();
          }}
        />
      )}
    </div>
  );
}
