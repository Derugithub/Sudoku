// Sudoku has no Pro version and no in-app purchases. The rewarded ad-free pass is the only way to hide ads.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(tsx?|js|json)$/.test(name) ? [path] : [];
  });
}

test('no billing permission, library or purchase code', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.deepEqual(deps.filter((d) => /iap|billing|purchase|revenuecat/i.test(d)), []);
  const sources = [join(root, 'app.json'), join(root, 'app.config.ts'), ...files(join(root, 'src'))];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /com\.android\.vending\.BILLING|BILLING|in-app purchase|removeAds|remove_ads|isPro\b|entitlement/i, file);
  }
});

test('the manifest asks for no microphone', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  assert.ok(!(app.expo.android.permissions ?? []).includes('android.permission.RECORD_AUDIO'));
});
