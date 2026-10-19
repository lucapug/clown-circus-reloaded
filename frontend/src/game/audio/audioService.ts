// Synthesized audio (issue #11): every sound is generated with Web Audio
// oscillators — no audio assets anywhere in the repo (spec §4). Timbre
// constants are verbatim from the baseline `useAudio.ts@0d365e6`; the
// baseline's setTimeout chains are replaced by up-front scheduling on the
// AudioContext clock (`t0 = ctx.currentTime + offset`, D2) so every
// OscillatorNode exists the moment a sound is triggered and stopAll() can
// cancel anything in flight — that is what makes "the game-over jingle must
// STOP when a new game starts" verifiable headlessly.

/** Structural minimum of an OscillatorNode the service actually touches. */
export interface OscillatorLike {
  type: string;
  frequency: { setValueAtTime(value: number, startTime: number): void };
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

/** Structural minimum of a GainNode the service actually touches. */
export interface GainLike {
  gain: {
    setValueAtTime(value: number, startTime: number): void;
    exponentialRampToValueAtTime(value: number, endTime: number): void;
  };
  connect(destination: unknown): unknown;
}

/** Structural minimum of AudioContext (real contexts satisfy this). */
export interface AudioContextLike {
  currentTime: number;
  state: string;
  destination: unknown;
  resume(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

export type AudioContextFactory = () => AudioContextLike;

export interface AudioService {
  pop(): void;
  bonus(): void;
  death(): void;
  bounce(): void;
  gameOverJingle(): void;
  startBackground(): void;
  stopAll(): void;
}

interface ToneSpec {
  freq: number;
  dur: number;
  type: OscillatorType;
  vol: number;
  /** Offset in seconds from "now" (schedule up-front on the AudioContext clock). */
  at: number;
}

// --- Timbre constants (verbatim from useAudio.ts@0d365e6) ---

// Chopin's Funeral March (baseline :63–78) — 11 notes; note start = cumulative dur + 60 ms.
const JINGLE_NOTES: readonly { freq: number; dur: number; accent?: boolean }[] = [
  { freq: 440.0, dur: 0.5, accent: true }, // A4
  { freq: 440.0, dur: 0.35 }, // A4
  { freq: 440.0, dur: 0.25 }, // A4
  { freq: 440.0, dur: 0.35 }, // A4
  { freq: 523.25, dur: 0.35, accent: true }, // C5
  { freq: 493.88, dur: 0.25 }, // B4
  { freq: 493.88, dur: 0.5, accent: true }, // B4
  { freq: 440.0, dur: 0.25 }, // A4
  { freq: 440.0, dur: 0.35 }, // A4
  { freq: 415.3, dur: 0.25 }, // G#4
  { freq: 440.0, dur: 0.7, accent: true }, // A4 (final)
];

// Relaxing pentatonic ambient (baseline :87–101) — note start = cumulative dur × 0.7.
const AMBIENT_NOTES: readonly { freq: number; dur: number }[] = [
  { freq: 196, dur: 1.2 }, // G3
  { freq: 220, dur: 0.8 }, // A3
  { freq: 262, dur: 1.0 }, // C4
  { freq: 294, dur: 1.4 }, // D4
  { freq: 330, dur: 0.6 }, // E4
  { freq: 262, dur: 1.0 }, // C4
  { freq: 220, dur: 1.2 }, // A3
  { freq: 196, dur: 1.6 }, // G3
  { freq: 165, dur: 1.0 }, // E3
  { freq: 196, dur: 0.8 }, // G3
  { freq: 220, dur: 1.4 }, // A3
  { freq: 262, dur: 1.0 }, // C4
];

class GraphAudioService implements AudioService {
  private ctx: AudioContextLike | null = null;
  private broken = false; // factory threw (no WebAudio) → permanent no-op
  private readonly nodes = new Set<OscillatorLike>();
  private bgRunning = false;
  private bgTimer: ReturnType<typeof setTimeout> | null = null; // the module's ONLY timer

  constructor(private readonly factory: AudioContextFactory) {}

  pop(): void {
    this.play([
      { freq: 800, dur: 0.05, type: 'square', vol: 0.2, at: 0 },
      { freq: 400, dur: 0.05, type: 'square', vol: 0.15, at: 0.03 }, // baseline setTimeout 30 ms
    ]);
  }

  bonus(): void {
    this.play(
      [523, 659, 784, 1047].map((freq, i) => ({ freq, dur: 0.15, type: 'square' as const, vol: 0.25, at: i * 0.08 })),
    );
  }

  death(): void {
    this.play(
      [400, 350, 300, 250, 200].map((freq, i) => ({
        freq,
        dur: 0.2,
        type: 'sawtooth' as const,
        vol: 0.2,
        at: i * 0.12,
      })),
    );
  }

  bounce(): void {
    this.play([{ freq: 300, dur: 0.08, type: 'triangle', vol: 0.15, at: 0 }]);
  }

  // D2: stopAll FIRST — the baseline played the march and only then "stopped"
  // the background, leaving already-scheduled ambient notes ringing into it.
  gameOverJingle(): void {
    this.stopAll();
    const specs: ToneSpec[] = [];
    let at = 0;
    for (const { freq, dur, accent } of JINGLE_NOTES) {
      const vol = accent ? 0.32 : 0.2;
      specs.push({ freq, dur: dur * 0.9, type: 'sawtooth', vol, at });
      specs.push({ freq: freq * 0.5, dur, type: 'triangle', vol: vol * 0.5, at }); // sub-octave
      if (accent) specs.push({ freq: freq * 2, dur: dur * 0.4, type: 'sine', vol: 0.05, at }); // harmonic
      at += dur + 0.06;
    }
    this.play(specs);
  }

  startBackground(): void {
    if (this.bgRunning) return; // already looping — never double-schedule
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.bgRunning = true;
    this.scheduleAmbientPass();
  }

  stopAll(): void {
    if (this.bgTimer !== null) {
      clearTimeout(this.bgTimer);
      this.bgTimer = null;
    }
    this.bgRunning = false;
    for (const osc of this.nodes) osc.stop();
    this.nodes.clear();
  }

  private play(specs: readonly ToneSpec[]): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const spec of specs) this.tone(ctx, spec, now);
  }

  private tone(ctx: AudioContextLike, { freq, dur, type, vol, at }: ToneSpec, now: number): void {
    const t0 = now + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.01, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur);
    this.nodes.add(osc); // tracked so stopAll() can cancel it mid-flight
  }

  private scheduleAmbientPass(): void {
    const specs: ToneSpec[] = [];
    let at = 0;
    for (const { freq, dur } of AMBIENT_NOTES) {
      specs.push({ freq, dur: dur * 0.85, type: 'sine', vol: 0.04, at });
      specs.push({ freq: freq * 2, dur: dur * 0.5, type: 'sine', vol: 0.015, at }); // subtle harmonic
      at += dur * 0.7; // overlap notes slightly for smoothness (baseline)
    }
    this.play(specs);
    // Single re-schedule timer, guarded by the flag checked before scheduling.
    this.bgTimer = setTimeout(() => {
      if (this.bgRunning) this.scheduleAmbientPass();
    }, at * 1000 + 2000);
  }

  private ensureContext(): AudioContextLike | null {
    if (this.broken) return null;
    if (this.ctx === null) {
      try {
        this.ctx = this.factory();
      } catch {
        this.broken = true; // jsdom / no-WebAudio browser — the game must never crash from audio
        return null;
      }
    }
    const ctx = this.ctx;
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }
}

const defaultFactory: AudioContextFactory = () => {
  // Legacy Safari prefixed constructor (baseline pattern, typed); when both
  // lookups miss (jsdom, no-WebAudio browser) the `new` throws and the
  // service becomes a permanent no-op.
  const legacy = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return new (window.AudioContext ?? legacy)();
};

/** Every trigger descends from SPACE/click (a user gesture), so lazy-on-first-call satisfies start-on-interaction. */
export const createAudioService = (factory: AudioContextFactory = defaultFactory): AudioService =>
  new GraphAudioService(factory);
