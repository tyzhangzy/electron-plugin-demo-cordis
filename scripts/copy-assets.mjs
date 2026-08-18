/**
 * scripts/copy-assets.mjs - build helper (ESM).
 *
 * Copies static runtime files into dist/:
 *   - index.html, style.css, config.json into dist/
 *   - each src/plugins/<name>/plugin.json into dist/plugins/<name>/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log('copied:', path.relative(root, to));
}

for (const f of ['index.html', 'style.css', 'config.json']) {
  const from = path.join(root, f);
  if (fs.existsSync(from)) copyFile(from, path.join(dist, f));
}

const pluginsDir = path.join(src, 'plugins');
if (fs.existsSync(pluginsDir)) {
  for (const name of fs.readdirSync(pluginsDir)) {
    const pj = path.join(pluginsDir, name, 'plugin.json');
    if (fs.existsSync(pj)) copyFile(pj, path.join(dist, 'plugins', name, 'plugin.json'));
  }
}

console.log('copy-assets done.');
