import { describe, expect, it } from 'vitest';
import { isDeathEvent, type GameEvent } from '../events';
import type { GameState } from '../types';
import {
  SNAPSHOT_TICKS,
  deathScenarios,
  playing,
  runScenario,
  scenarioAInputs,
  scenarioBInputs,
  scenarioBStart,
  type ScenarioRun,
} from './golden-scenarios';

// Issue #6 AC 1: committed golden fixtures reproduce scripted, seeded runs
// exactly (full-state JSON.stringify equality — no rounding; IEEE-754
// arithmetic is deterministic). Per design decision 1, each recorded tick
// snapshot also includes the events emitted in that tick, in emission order,
// so event ordering across long runs is pinned too. Fixtures live in
// __fixtures__/golden-*.json.
const fixtures = import.meta.glob<Record<string, unknown>>('./__fixtures__/golden-*.json', {
  import: 'default',
  eager: true,
});

interface GoldenFixture {
  scenario: string;
  snapshotTicks: number[];
  snapshots: Record<string, GameState & { events: GameEvent[] }>;
}

const fixtureFor = (name: string): GoldenFixture => {
  const entry = Object.entries(fixtures).find(([path]) => path.endsWith(`/golden-${name}.json`));
  if (!entry) throw new Error(`missing committed fixture: __fixtures__/golden-${name}.json`);
  return entry[1] as unknown as GoldenFixture;
};

const expectGoldenMatch = (name: string, run: ScenarioRun): void => {
  const fixture = fixtureFor(name);
  for (const tick of SNAPSHOT_TICKS) {
    // State AND per-tick events, byte equality, as one snapshot.
    const actual = JSON.stringify({ ...run.snapshots[tick], events: run.eventSnapshots[tick] });
    const expected = JSON.stringify(fixture.snapshots[String(tick)]);
    expect(actual, `${name} diverged from the golden fixture at tick ${tick}`).toBe(expected);
  }
};

describe('golden tick snapshots (issue AC 1)', () => {
  it('scenario (a): seed 42, board-clown launch at tick 10, seated launch at tick 20, periodic move-seesaw, 300 ticks', () => {
    const run = runScenario(playing(), scenarioAInputs, 42);
    expectGoldenMatch('a-seed42', run);
    // The run must actually exercise the seeded path, not sit still.
    expect(run.events.some((e) => e.type === 'launched' && e.via === 'input')).toBe(true);
  });

  it('scenario (b): constructed edge landing chain-launches the seated clown, then the stretch plays out', () => {
    const run = runScenario(scenarioBStart(), scenarioBInputs, 7);
    expectGoldenMatch('b-chain', run);
    expect(run.events.some((e) => e.type === 'landed-edge')).toBe(true);
    expect(run.events.some((e) => e.type === 'launched' && e.via === 'chain')).toBe(true);
  });

  it.each(deathScenarios())('scenario (c) $name reaches its death cause with stats untouched', (scenario) => {
    const run = runScenario(scenario.start, () => [], 3);
    expectGoldenMatch(scenario.name, run);
    const death = run.events.find(isDeathEvent);
    expect(death?.cause).toBe(scenario.cause);
    // nullConsequences is the identity: the kernel detected the death but
    // never wrote stats (lives stay 1) — the #6/#7 seam line.
    expect(run.finalState.stats).toEqual({ score: 0, lives: 1, bonusJumps: 0 });
  });

  it('fixtures cover the full DoD snapshot-tick set', () => {
    for (const name of ['a-seed42', 'b-chain', ...deathScenarios().map((s) => s.name)]) {
      expect(fixtureFor(name).snapshotTicks).toEqual([...SNAPSHOT_TICKS]);
    }
  });
});
