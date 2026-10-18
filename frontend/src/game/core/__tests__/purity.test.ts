import { describe, expect, it } from 'vitest';

// Spec §6.1: the core is framework-free — no React/canvas code, no DOM/browser
// globals. Decided implementation: an import-boundary test over the raw source
// of every core module (no lint plugin in the scaffold).
const coreSources: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../**/*.ts', { query: '?raw', import: 'default', eager: true }),
  ).filter(([path]) => !path.includes('__tests__') && !/\.test\.ts$/.test(path)),
);

// The core module set from the issue #6 file tree.
const CORE_MODULES = ['constants', 'rng', 'types', 'state', 'engine', 'events', 'index'];

const FORBIDDEN_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\breact\b/i, 'React import or reference'],
  [/react-dom/i, 'react-dom import or reference'],
  [/\bdocument\b/i, 'DOM document reference'],
  [/\bwindow\b/i, 'browser window reference'],
  [/\brequestAnimationFrame\b/i, 'requestAnimationFrame reference'],
  [/\bcanvas\b/i, 'canvas reference'],
];

describe('core purity (spec §6.1)', () => {
  it('scans every core source file outside __tests__', () => {
    const names = Object.keys(coreSources).map((path) => path.split('/').pop() ?? '').map((name) => name.replace(/\.ts$/, ''));
    expect(names.sort()).toEqual([...CORE_MODULES].sort());
  });

  it('imports no React/DOM module and references no browser global', () => {
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(coreSources)) {
      for (const [pattern, label] of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) offenders.push(`${path}: ${label} (${pattern})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
