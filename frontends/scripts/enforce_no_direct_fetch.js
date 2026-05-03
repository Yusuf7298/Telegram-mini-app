// Fails build if 'fetch(' or 'axios(' is found outside apiErrorHandler.ts
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ALLOWED = [
  path.join('lib', 'apiErrorHandler.ts'),
];

function walk(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p, callback);
    } else {
      callback(p);
    }
  });
}

let violations = [];
walk(ROOT, (file) => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;
  const rel = path.relative(ROOT, file);
  if (ALLOWED.some((allowed) => rel.endsWith(allowed))) return;
  const content = fs.readFileSync(file, 'utf8');
  if (/fetch\s*\(/.test(content) || /axios\s*\(/.test(content)) {
    violations.push(rel);
  }
});

if (violations.length) {
  console.error('Direct fetch/axios usage found in:', violations);
  process.exit(1);
}
