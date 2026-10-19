import { describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '../../core';
import { createAudioEventMapper } from '../eventMapper';

// Pure mapper tests (issue #11 test strategy): the audio side is a fake
// AudioService of vi.fn() methods — the mapper must produce exactly the
// decision-3 table, including the silent chain launch.
const fakeAudio = () => ({
  pop: vi.fn(),
  bonus: vi.fn(),
  death: vi.fn(),
  bounce: vi.fn(),
  gameOverJingle: vi.fn(),
  startBackground: vi.fn(),
  stopAll: vi.fn(),
});
type FakeAudio = ReturnType<typeof fakeAudio>;

const mapper = (audio: FakeAudio) => createAudioEventMapper(audio);

const launched = (via: 'input' | 'chain'): GameEvent => ({ type: 'launched', clownIndex: 0, via, vx: 1, vy: 0 });
const popped: GameEvent = { type: 'balloon-popped', balloonId: '2-1', row: 2, color: 'green', x: 0.5, y: 0.5 };
const rowCleared: GameEvent = { type: 'row-cleared', row: 2, color: 'green' };
const levelCompleted: GameEvent = { type: 'level-completed', newLevel: 2 };
const landedEdge: GameEvent = { type: 'landed-edge', clownIndex: 1, side: 'left' };
const boardBounced: GameEvent = { type: 'board-bounced', clownIndex: 0 };
const death = (cause: 'middle' | 'occupied-edge' | 'fall-off'): GameEvent => ({
  type: 'death',
  clownIndex: 0,
  cause,
});
const gameOver: GameEvent = { type: 'game-over' };

const expectSilence = (audio: FakeAudio) => {
  for (const fn of Object.values(audio)) expect(fn).not.toHaveBeenCalled();
};

describe('createAudioEventMapper — decision-3 table (baseline useGameEngine.ts@0d365e6 call sites)', () => {
  it('balloon-popped → pop()', () => {
    const audio = fakeAudio();
    mapper(audio)([popped]);
    expect(audio.pop).toHaveBeenCalledTimes(1);
    expect(audio.bonus).not.toHaveBeenCalled();
  });

  it('row-cleared → bonus()', () => {
    const audio = fakeAudio();
    mapper(audio)([rowCleared]);
    expect(audio.bonus).toHaveBeenCalledTimes(1);
  });

  it('level-completed → bonus() (baseline LEVEL UP reused playBonus)', () => {
    const audio = fakeAudio();
    mapper(audio)([levelCompleted]);
    expect(audio.bonus).toHaveBeenCalledTimes(1);
  });

  it('landed-edge → bounce()', () => {
    const audio = fakeAudio();
    mapper(audio)([landedEdge]);
    expect(audio.bounce).toHaveBeenCalledTimes(1);
  });

  it('board-bounced → bounce()', () => {
    const audio = fakeAudio();
    mapper(audio)([boardBounced]);
    expect(audio.bounce).toHaveBeenCalledTimes(1);
  });

  it('launched {via:"input"} → bounce() (baseline launchClown)', () => {
    const audio = fakeAudio();
    mapper(audio)([launched('input')]);
    expect(audio.bounce).toHaveBeenCalledTimes(1);
  });

  it('launched {via:"chain"} → SILENT — the same-tick landed-edge bounce is the feedback', () => {
    const audio = fakeAudio();
    mapper(audio)([launched('chain')]);
    expectSilence(audio);
  });

  it('death → death() for ALL three causes (middle, occupied-edge, fall-off)', () => {
    const audio = fakeAudio();
    mapper(audio)([death('middle'), death('occupied-edge'), death('fall-off')]);
    expect(audio.death).toHaveBeenCalledTimes(3);
  });

  it('game-over → gameOverJingle()', () => {
    const audio = fakeAudio();
    mapper(audio)([gameOver]);
    expect(audio.gameOverJingle).toHaveBeenCalledTimes(1);
    expect(audio.death).not.toHaveBeenCalled(); // the march replaces any per-event tone
  });

  it('maps a mixed tick in event order', () => {
    const audio = fakeAudio();
    mapper(audio)([launched('input'), popped, rowCleared, landedEdge, death('fall-off'), gameOver]);
    const order = (fn: ReturnType<typeof vi.fn>, call = 0) => fn.mock.invocationCallOrder[call];
    expect(order(audio.bounce)).toBeLessThan(order(audio.pop));
    expect(order(audio.pop)).toBeLessThan(order(audio.bonus));
    expect(order(audio.bonus)).toBeLessThan(order(audio.bounce, 1)); // second bounce (landed-edge)
    expect(audio.death).toHaveBeenCalledTimes(1);
    expect(order(audio.death)).toBeLessThan(order(audio.gameOverJingle));
  });

  it('an empty event array is a no-op', () => {
    const audio = fakeAudio();
    expect(() => mapper(audio)([])).not.toThrow();
    expectSilence(audio);
  });
});
