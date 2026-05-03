// Fails if any .spec.ts file in e2e/ imports from '@playwright/test' directly
const fs = require('fs');
const path = require('path');

function walk(dir, ext = '.spec.ts', found = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, ext, found);
    else if (full.endsWith(ext)) found.push(full);
  }
  return found;
}

const root = path.join(__dirname, '../tests/e2e');
const files = walk(root);
let failed = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (/from ['"]@playwright\/test['"]/.test(content)) {
    console.error(`❌ Invalid Playwright import in: ${file}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nAll Playwright test files must import from ./playwright-fixtures.');
  process.exit(1);
} else {
  console.log('✅ All Playwright test files use custom fixtures.');
}
