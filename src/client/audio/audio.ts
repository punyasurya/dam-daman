/**
 * Semua suara dibuat langsung dengan Web Audio (tanpa file rekaman),
 * jadi bebas lisensi. Musik latar bernuansa gamelan dengan tangga nada slendro.
 */

export type Sfx =
  | 'select'
  | 'move'
  | 'capture'
  | 'promote'
  | 'dam'
  | 'lalai'
  | 'turn'
  | 'win'
  | 'lose'
  | 'draw'
  | 'tick'
  | 'invalid'
  | 'pop';

// Slendro kira-kira: 5 nada sama jarak dalam satu oktaf.
const BASE = 293.66;
const slendro = (degree: number, octave = 0) => BASE * Math.pow(2, octave + degree / 5);

// Balungan (notasi slendro 1,2,3,5,6 -> derajat 0..4; 0 = jeda)
const NOTE: Record<number, number> = { 1: 0, 2: 1, 3: 2, 5: 3, 6: 4 };
const GONGAN: number[][] = [
  [2, 1, 2, 6, 2, 1, 2, 6, 3, 5, 6, 5, 3, 2, 1, 2],
  [5, 6, 1, 6, 5, 3, 2, 3, 6, 5, 3, 2, 5, 3, 2, 1],
  [3, 2, 3, 5, 6, 5, 3, 2, 1, 2, 3, 5, 6, 1, 6, 5],
  [6, 5, 3, 2, 3, 5, 6, 1, 2, 1, 6, 5, 3, 2, 1, 2],
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextBeatTime = 0;
  private beat = 0;
  private gongan = 0;
  musicVolume = 0.35;
  sfxVolume = 0.8;
  musicOn = true;
  sfxOn = true;
  vibrate = true;

  /** Dipanggil pada interaksi pertama pengguna (kebijakan autoplay browser). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.applyVolumes();
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  get ready() {
    return !!this.ctx;
  }

  setPrefs(p: { musicVolume: number; sfxVolume: number; musicOn: boolean; sfxOn: boolean; vibrate: boolean }) {
    this.musicVolume = p.musicVolume;
    this.sfxVolume = p.sfxVolume;
    this.vibrate = p.vibrate;
    const wasOn = this.musicOn;
    this.musicOn = p.musicOn;
    this.sfxOn = p.sfxOn;
    this.applyVolumes();
    if (this.ctx) {
      if (this.musicOn && !wasOn) this.startMusic();
      if (!this.musicOn && wasOn) this.stopMusic();
    }
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicOn ? this.musicVolume * 0.55 : 0, t, 0.08);
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? this.sfxVolume : 0, t, 0.02);
  }

  // ---------- Instrumen ----------

  /** Bilah logam (saron/bonang): nada dasar + parsial inharmonik + "ombak" (detune). */
  private metal(bus: AudioNode, f: number, t: number, dur: number, vol: number, bright = 1) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(bus);
    const partials: Array<[number, number, number]> = [
      [1, 1, 1],
      [1.0045, 0.6, 1],
      [2.76, 0.28 * bright, 0.35],
      [5.4, 0.12 * bright, 0.18],
    ];
    for (const [ratio, amp, life] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * life);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private gong(bus: AudioNode, f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(bus);
    for (const [ratio, amp] of [[1, 1], [1.012, 0.8], [2.01, 0.25], [2.98, 0.08]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * ratio * 1.02, t);
      o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.25);
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private drum(bus: AudioNode, t: number, pitch: number, vol: number, dur = 0.18) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(pitch, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
    if (this.noiseBuf) {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = pitch * 6;
      bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      n.connect(bp).connect(ng).connect(bus);
      n.start(t);
      n.stop(t + 0.08);
    }
  }

  private wood(bus: AudioNode, t: number, f: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.15);
    if (this.noiseBuf) {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.35, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      n.connect(hp).connect(ng).connect(bus);
      n.start(t);
      n.stop(t + 0.04);
    }
  }

  // ---------- Musik latar ----------

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextBeatTime = this.ctx.currentTime + 0.15;
    this.beat = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic() {
    const ctx = this.ctx!;
    const beatLen = 0.62;
    while (this.nextBeatTime < ctx.currentTime + 0.3) {
      const t = this.nextBeatTime;
      const seq = GONGAN[this.gongan % GONGAN.length];
      const i = this.beat % 16;
      const n = seq[i];
      const next = seq[(i + 1) % 16];
      const bus = this.musicBus;
      if (n) {
        // Saron: balungan
        this.metal(bus, slendro(NOTE[n], 0), t, 1.2, 0.16);
        // Peking: dua kali lipat, satu oktaf di atas
        this.metal(bus, slendro(NOTE[n], 1), t, 0.45, 0.06, 0.6);
        this.metal(bus, slendro(NOTE[next] ?? NOTE[n], 1), t + beatLen / 2, 0.45, 0.05, 0.6);
        // Bonang: imbal sederhana
        if (i % 2 === 1) {
          this.metal(bus, slendro(NOTE[n], 1), t + beatLen * 0.25, 0.3, 0.035, 0.4);
          this.metal(bus, slendro(NOTE[next] ?? NOTE[n], 1), t + beatLen * 0.75, 0.3, 0.035, 0.4);
        }
      }
      // Kenong tiap 4 ketukan, kempul di tengah gatra, gong di akhir gongan
      if (i % 4 === 3) this.metal(bus, slendro(NOTE[n] ?? 0, -1), t, 1.6, 0.07, 0.3);
      if (i === 5 || i === 9 || i === 13) this.gong(bus, slendro(NOTE[n] ?? 0, -2), t, 1.8, 0.09);
      if (i === 15) this.gong(bus, 61.7, t, 4.5, 0.22);
      // Kendang
      if (i % 2 === 0) this.drum(bus, t + beatLen * 0.5, 150, 0.12);
      if (i % 4 === 2) this.drum(bus, t + beatLen * 0.75, 95, 0.1);
      if (i % 8 === 7) this.drum(bus, t + beatLen * 0.25, 210, 0.07, 0.1);

      this.nextBeatTime += beatLen;
      this.beat++;
      if (this.beat % 16 === 0) this.gongan++;
    }
  }

  // ---------- Efek suara ----------

  play(s: Sfx, opts: { chain?: number } = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime + 0.01;
    const bus = this.sfxBus;
    switch (s) {
      case 'select':
        this.wood(bus, t, 900, 0.25);
        break;
      case 'move':
        this.wood(bus, t, 420, 0.5);
        break;
      case 'capture': {
        const k = Math.min(opts.chain ?? 0, 6);
        this.drum(bus, t, 90, 0.45);
        this.metal(bus, slendro(k % 5, 1 + Math.floor(k / 5)), t + 0.02, 0.6, 0.3);
        if (this.vibrate) navigator.vibrate?.(30);
        break;
      }
      case 'promote':
        [0, 2, 4, 5].forEach((d, i) => this.metal(bus, slendro(d % 5, 1 + Math.floor(d / 5)), t + i * 0.09, 0.9, 0.22));
        break;
      case 'dam':
        this.gong(bus, 61.7, t, 3.5, 0.6);
        this.drum(bus, t, 110, 0.6, 0.3);
        this.drum(bus, t + 0.14, 160, 0.4);
        this.metal(bus, slendro(3, 1), t + 0.05, 0.8, 0.25);
        if (this.vibrate) navigator.vibrate?.([60, 40, 90]);
        break;
      case 'lalai':
        this.metal(bus, slendro(4, 1), t, 0.4, 0.25);
        this.metal(bus, slendro(4, 1), t + 0.16, 0.4, 0.25);
        break;
      case 'turn':
        this.metal(bus, slendro(2, 1), t, 0.8, 0.14, 0.5);
        break;
      case 'win':
        [0, 1, 2, 3, 4, 5].forEach((d, i) => this.metal(bus, slendro(d % 5, 1 + Math.floor(d / 5)), t + i * 0.12, 1.0, 0.24));
        this.gong(bus, 61.7, t + 0.75, 4, 0.5);
        break;
      case 'lose':
        [4, 3, 2, 1, 0].forEach((d, i) => this.metal(bus, slendro(d, 0), t + i * 0.18, 1.0, 0.2, 0.5));
        this.gong(bus, 55, t + 0.9, 3, 0.35);
        break;
      case 'draw':
        this.metal(bus, slendro(0, 1), t, 1, 0.2);
        this.metal(bus, slendro(0, 1), t + 0.25, 1, 0.2);
        break;
      case 'tick':
        this.wood(bus, t, 1500, 0.12);
        break;
      case 'invalid':
        this.drum(bus, t, 70, 0.3, 0.12);
        break;
      case 'pop':
        this.wood(bus, t, 1200, 0.2);
        this.wood(bus, t + 0.06, 1600, 0.15);
        break;
    }
  }
}

export const audio = new AudioEngine();
