import { describe, expect, it, vi } from 'vitest';
import { createAudioService } from '../audioService';

// jsdom has NO WebAudio (issue #11 test strategy): every test injects the
// brief-specified fake context — a recording spy whose created oscillators
// and gains are captured so counts/types/frequencies/volumes and the
// stop-everything lifecycle AC are assertable headlessly.
interface FakeOscillator {
  type: string;
  frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface FakeGain {
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
}

interface FakeContext {
  currentTime: number;
  state: string;
  destination: Record<string, never>;
  resume: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
}

const createFakeContext = (state = 'running'): { ctx: FakeContext; oscillators: FakeOscillator[]; gains: FakeGain[] } => {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  const ctx: FakeContext = {
    currentTime: 0,
    state,
    destination: {},
    resume: vi.fn(async () => {}),
    createOscillator: vi.fn((): FakeOscillator => {
      const osc: FakeOscillator = {
        type: '',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn((): FakeGain => {
      const gain: FakeGain = {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
  };
  return { ctx, oscillators, gains };
};

/** Fake context + a service over it, with the created nodes exposed for assertions. */
const make = (state = 'running') => {
  const { ctx, oscillators, gains } = createFakeContext(state);
  const factory = vi.fn(() => ctx);
  const service = createAudioService(factory);
  return { ctx, oscillators, gains, factory, service };
};

const freqOf = (osc: FakeOscillator): number => osc.frequency.setValueAtTime.mock.calls[0][0] as number;
const startedAt = (osc: FakeOscillator): number => osc.start.mock.calls[0][0] as number;
const stoppedAt = (osc: FakeOscillator): number => osc.stop.mock.calls[0][0] as number;
const volOf = (gain: FakeGain): number => gain.gain.setValueAtTime.mock.calls[0][0] as number;
const rampAt = (gain: FakeGain): number => gain.gain.exponentialRampToValueAtTime.mock.calls[0][1] as number;
// stopAll() cancels a tracked node with an ARG-LESS stop() (the Web Audio
// "last invocation wins" re-stop); scheduled stops always carry t0 + dur.
const cancelled = (osc: FakeOscillator): boolean => osc.stop.mock.calls.some((call) => call.length === 0);

describe('createAudioService — lazy context and no-WebAudio permanence (issue #11 decision 1)', () => {
  it('does not touch the factory until the first sound, then reuses one context', () => {
    const { factory, service, ctx } = make();
    expect(factory).not.toHaveBeenCalled();
    service.bounce();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    service.pop();
    service.startBackground();
    expect(factory).toHaveBeenCalledTimes(1); // same context, never recreated
  });

  it('resumes a suspended context on first use (start-on-interaction policy)', () => {
    const { ctx, service } = make('suspended');
    service.bounce();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('a throwing factory makes the service a PERMANENT no-op — audio never crashes the game', () => {
    const factory = vi.fn(() => {
      throw new TypeError('window.AudioContext is not a constructor'); // jsdom: `new undefined()`
    });
    const service = createAudioService(factory);
    expect(() => {
      service.pop();
      service.bonus();
      service.death();
      service.bounce();
      service.gameOverJingle();
      service.startBackground();
      service.stopAll();
    }).not.toThrow();
    expect(factory).toHaveBeenCalledTimes(1); // first call only — no retry loop
  });
});

describe('createAudioService — timbre (verbatim from baseline useAudio.ts@0d365e6)', () => {
  it('pop: square 800 Hz + square 400 Hz at +30 ms, 0.05 s each, vols 0.2/0.15', () => {
    const { service, ctx, oscillators, gains } = make();
    service.pop();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(oscillators.map((o) => o.type)).toEqual(['square', 'square']);
    expect(oscillators.map(freqOf)).toEqual([800, 400]);
    expect(startedAt(oscillators[0])).toBe(0);
    expect(startedAt(oscillators[1])).toBeCloseTo(0.03);
    expect(stoppedAt(oscillators[0])).toBeCloseTo(0.05);
    expect(stoppedAt(oscillators[1])).toBeCloseTo(0.03 + 0.05);
    expect(gains.map(volOf)).toEqual([0.2, 0.15]);
    expect(rampAt(gains[0])).toBeCloseTo(0.05); // exponentialRampToValueAtTime(0.01, t0 + dur)
    expect(rampAt(gains[1])).toBeCloseTo(0.03 + 0.05);
  });

  it('bonus: square arpeggio 523/659/784/1047 Hz, 0.15 s each, vol 0.25, 80 ms steps', () => {
    const { service, oscillators, gains } = make();
    service.bonus();
    expect(oscillators).toHaveLength(4);
    expect(oscillators.every((o) => o.type === 'square')).toBe(true);
    expect(oscillators.map(freqOf)).toEqual([523, 659, 784, 1047]);
    expect(oscillators.map(startedAt)).toEqual([0, 0.08, 0.16, 0.24].map((t) => expect.closeTo(t)));
    expect(oscillators.map(stoppedAt)).toEqual([0.15, 0.23, 0.31, 0.39].map((t) => expect.closeTo(t)));
    expect(gains.map(volOf)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it('death: sawtooth 400/350/300/250/200 Hz, 0.2 s each, vol 0.2, 120 ms steps', () => {
    const { service, oscillators, gains } = make();
    service.death();
    expect(oscillators).toHaveLength(5);
    expect(oscillators.every((o) => o.type === 'sawtooth')).toBe(true);
    expect(oscillators.map(freqOf)).toEqual([400, 350, 300, 250, 200]);
    expect(oscillators.map(startedAt)).toEqual([0, 0.12, 0.24, 0.36, 0.48].map((t) => expect.closeTo(t)));
    expect(gains.map(volOf)).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
    expect(oscillators.map(stoppedAt)).toEqual([0.2, 0.32, 0.44, 0.56, 0.68].map((t) => expect.closeTo(t)));
  });

  it('bounce: a single triangle 300 Hz, 0.08 s, vol 0.15', () => {
    const { service, oscillators, gains } = make();
    service.bounce();
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].type).toBe('triangle');
    expect(freqOf(oscillators[0])).toBe(300);
    expect(startedAt(oscillators[0])).toBe(0);
    expect(stoppedAt(oscillators[0])).toBeCloseTo(0.08);
    expect(volOf(gains[0])).toBe(0.15);
  });

  it('game-over jingle: 26 oscillators — 11 sawtooth leads, 11 triangle sub-octaves, 4 accent harmonics', () => {
    const { service, oscillators } = make();
    service.gameOverJingle();
    expect(oscillators).toHaveLength(26);
    expect(oscillators.filter((o) => o.type === 'sawtooth')).toHaveLength(11);
    expect(oscillators.filter((o) => o.type === 'triangle')).toHaveLength(11);
    expect(oscillators.filter((o) => o.type === 'sine')).toHaveLength(4);
  });

  it('jingle note 1 (accented A4): saw 440 vol .32 dur .45 + tri 220 vol .16 + sine 880 vol .05', () => {
    const { service, oscillators, gains } = make();
    service.gameOverJingle();
    const [lead, sub, harmonic] = oscillators;
    expect(lead.type).toBe('sawtooth');
    expect(freqOf(lead)).toBe(440); // A4
    expect(startedAt(lead)).toBe(0);
    expect(stoppedAt(lead)).toBeCloseTo(0.45); // dur 0.5 × 0.9
    expect(volOf(gains[0])).toBe(0.32);
    expect(sub.type).toBe('triangle');
    expect(freqOf(sub)).toBe(220); // freq × 0.5
    expect(stoppedAt(sub)).toBeCloseTo(0.5); // full dur
    expect(volOf(gains[1])).toBeCloseTo(0.16); // vol × 0.5
    expect(harmonic.type).toBe('sine');
    expect(freqOf(harmonic)).toBe(880); // freq × 2, accents only
    expect(stoppedAt(harmonic)).toBeCloseTo(0.2); // dur × 0.4
    expect(volOf(gains[2])).toBe(0.05);
  });

  it('jingle march timing: note 2 starts at 0.5 + 0.06 (cumulative dur + 60 ms)', () => {
    const { service, oscillators } = make();
    service.gameOverJingle();
    const lead2 = oscillators[3]; // [saw, tri] pair of note 2 — no accent harmonic
    expect(lead2.type).toBe('sawtooth');
    expect(freqOf(lead2)).toBe(440);
    expect(startedAt(lead2)).toBeCloseTo(0.56);
    expect(stoppedAt(lead2)).toBeCloseTo(0.56 + 0.35 * 0.9);
  });
});

describe('createAudioService — background ambient (issue #11 decision 4)', () => {
  it('one pass = 24 sine oscillators: 12 pentatonic notes plus octave harmonics, vols 0.04/0.015', () => {
    const { service, oscillators, gains } = make();
    service.startBackground();
    expect(oscillators).toHaveLength(24);
    expect(oscillators.every((o) => o.type === 'sine')).toBe(true);
    expect(oscillators.map(freqOf)).toEqual([
      196, 392, 220, 440, 262, 524, 294, 588, 330, 660, 262, 524,
      220, 440, 196, 392, 165, 330, 196, 392, 220, 440, 262, 524,
    ]);
    const vols = gains.map(volOf);
    expect(vols.filter((v) => v === 0.04)).toHaveLength(12);
    expect(vols.filter((v) => v === 0.015)).toHaveLength(12);
  });

  it('startBackground is idempotent while running — no doubled ambient passes', () => {
    const { service, oscillators } = make();
    service.startBackground();
    service.startBackground();
    expect(oscillators).toHaveLength(24);
  });

  it('re-schedules the next pass ~2 s after the pass (total dur × 0.7 = 9.1 s), until stopped', () => {
    vi.useFakeTimers();
    try {
      const { service, oscillators } = make();
      service.startBackground();
      expect(oscillators).toHaveLength(24);
      vi.advanceTimersByTime(9100 + 2000);
      expect(oscillators).toHaveLength(48); // second ambient pass scheduled on the clock
      service.stopAll();
      vi.advanceTimersByTime(60_000);
      expect(oscillators).toHaveLength(48); // re-schedule timer cleared by stopAll
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createAudioService — lifecycle AC: the jingle must STOP when a new game starts', () => {
  it('stopAll after gameOverJingle cancels EVERY scheduled oscillator (arg-less stop)', () => {
    const { service, oscillators } = make();
    service.gameOverJingle();
    expect(oscillators).toHaveLength(26);
    expect(oscillators.some(cancelled)).toBe(false); // only scheduled stops so far
    service.stopAll();
    expect(oscillators.every(cancelled)).toBe(true);
  });

  it('startBackground after stopAll creates and starts FRESH nodes', () => {
    const { service, oscillators } = make();
    service.gameOverJingle();
    service.stopAll();
    service.startBackground();
    const fresh = oscillators.slice(26);
    expect(fresh).toHaveLength(24);
    expect(fresh.every((o) => o.start.mock.calls.length === 1)).toBe(true);
  });

  it('gameOverJingle silences a ringing ambient pass first (stopAll, then the march)', () => {
    const { service, oscillators } = make();
    service.startBackground();
    service.gameOverJingle();
    const ambient = oscillators.slice(0, 24);
    expect(ambient.every(cancelled)).toBe(true);
    expect(oscillators).toHaveLength(24 + 26); // ambient pass + full march, all tracked
  });

  it('stopAll before any sound is a safe no-op and never creates the context', () => {
    const { factory, service } = make();
    expect(() => service.stopAll()).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
});
