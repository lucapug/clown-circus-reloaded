import { expect, test } from '@playwright/test';

// Minimal structural view of the `window.__game` surface (issue #9) this
// test consumes. The hooks are DEV-gated AT THE CALL SITE (useGameLoop), so
// their mere presence proves the page under test is a DEV build.
declare global {
  interface Window {
    __game?: {
      reset(seed?: number): void;
      advanceTicks(n: number): void;
      inject(patch: object): void;
      getState(): { phase: string };
    };
  }
}

// Issue #46 — the single happy-path scenario (mechanism check only, per
// qa.md: gameplay acceptance stays with the owner's recorded sessions).
// Spec §6 E2E hooks drive the game: seeded reset → synchronous fast-forward
// → forced game over through the REAL lives-0 transition — seconds, not
// minutes. Submit goes to the REAL backend (compose :18000; the webServer
// env sets VITE_USE_MOCK_LEADERBOARD=0), and the teardown's `down -v`
// guarantees an empty DB, so the unique entry cannot be outranked.
test('happy path: load → play (hooks) → game over → submit → leaderboard', async ({ page }) => {
  await page.goto('/');

  // DEV-build runtime proof: the debug API is installed on mount.
  await page.waitForFunction(() => window.__game !== undefined);

  // Idle → playing through the real StartScreen button.
  await page.getByRole('button', { name: 'START GAME' }).click();

  // Deterministic seed: fresh level-1 'playing' state (same path as Play Again).
  await page.evaluate(() => window.__game!.reset(42));

  // Fast-forward: 120 synchronous fixed-timestep ticks — seconds of
  // simulation in milliseconds, no rAF dependence.
  await page.evaluate(() => window.__game!.advanceTicks(120));

  // Forced game over through the REAL transition: inject lives 0, then the
  // next tick's core step-8 check flips phase to 'gameover' (the pattern
  // proven in src/components/game/__tests__/debugHooks.test.tsx:103–107).
  await page.evaluate(() => {
    window.__game!.inject({ stats: { score: 4242, lives: 0, bonusJumps: 0 } });
    window.__game!.advanceTicks(1);
  });
  expect(await page.evaluate(() => window.__game!.getState().phase)).toBe('gameover');

  // GameOver overlay renders the injected score, zero-padded to 6 digits.
  await expect(page.getByTestId('final-score')).toHaveText('004242');

  // Unique per-run name (input maxLength and the wire limit are 10 chars).
  const name = `e${Date.now().toString(36)}`;
  await page.getByTestId('player-name').fill(name);
  await page.getByTestId('save-score').click();
  await expect(page.getByText('Score Saved!')).toBeVisible();

  // The entry renders in the GameOver leaderboard scroll…
  const scroll = page.getByTestId('leaderboard-scroll');
  await expect(scroll).toContainText(name);
  await expect(scroll).toContainText('4242');

  // …and round-tripped the real API (POST /scores → GET /leaderboard).
  const res = await fetch('http://127.0.0.1:18000/leaderboard?limit=10');
  expect(res.ok).toBeTruthy();
  const { entries } = (await res.json()) as { entries: Array<{ name: string; score: number }> };
  expect(entries.some((entry) => entry.name === name && entry.score === 4242)).toBe(true);
});
