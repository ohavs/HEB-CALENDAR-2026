/**
 * פלאגין של Capacitor שמוחזר ישירות מפונקציה אסינכרונית תוקע את ה-`await`
 * לנצח. כך הגדרות המקום לא נרשמו מעולם ומתג היומן לא הופיע - בלי שגיאה.
 * ראו את ההערה מעל `geofencePlugin` ב-`native.ts`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registerPlugin } from '@capacitor/core';

const TIMEOUT = Symbol('timeout');
const settle = <T>(p: Promise<T>) =>
  Promise.race([
    p.then(
      () => 'resolved' as const,
      () => 'rejected' as const,
    ),
    new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), 200)),
  ]);

describe('Capacitor plugin proxies', () => {
  it('treat `then` as a native call that never answers the awaiting promise', async () => {
    // זה מה ש-`await` עושה לערך שמוחזר מפונקציה אסינכרונית: קורא ל-then שלו
    const proxy = registerPlugin<object>('ProxyProbeBare') as {
      then: (ok: () => void, fail: () => void) => Promise<unknown>;
    };
    let answered = false;
    const call = proxy.then(
      () => (answered = true),
      () => (answered = true),
    );
    await call.catch(() => undefined);
    expect(answered).toBe(false);
  });

  it('settle when wrapped in an object', async () => {
    const wrapped = async () => ({ plugin: registerPlugin<object>('ProxyProbeWrapped') });
    expect(await settle(wrapped())).toBe('resolved');
  });

  it('are never returned bare from an async function in src', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) files.push(path);
      }
    };
    walk(join(__dirname, '..'));

    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/return\s+registerPlugin\b/g)) {
        const before = text.slice(0, match.index);
        const fn = before.lastIndexOf('function ');
        const asyncFn = before.lastIndexOf('async function ');
        const asyncArrow = before.search(/async\s*\([^)]*\)\s*=>[^]*$/);
        if ((asyncFn >= 0 && asyncFn + 6 === fn) || asyncArrow > fn) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
