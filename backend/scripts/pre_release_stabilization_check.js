// Pre-release stabilization enforcement script
// Fails if any forbidden patterns are found in the codebase

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CRITICAL_SERVICES = [
  'reward.service.ts',
  'rules.service.ts',
  'referral.service.ts',
  'wallet.service.ts',
  'game.service.ts',
];

const forbiddenPatterns = [
  // Math.random or crypto.randomInt outside reward.service
  {
    pattern: /Math\.random|crypto\.randomInt/,
    allowFiles: ['reward.service.ts'],
    message: 'Forbidden random number usage outside reward.service.ts',
  },
  // generateReward( outside reward.service
  {
    pattern: /generateReward\s*\(/,
    allowFiles: ['reward.service.ts'],
    message: 'generateReward() must only be called from reward.service.ts',
  },
  // referralStatus = outside referral.service
  {
    pattern: /referralStatus\s*=/,
    allowFiles: ['referral.service.ts'],
    message: 'Direct referralStatus assignment must only occur in referral.service.ts',
  },
  // prisma.user.update({ balance }) outside wallet.service
  {
    pattern: /prisma\.user\.update\s*\(\s*{[^}]*balance[^}]*(}|$)/s,
    allowFiles: ['wallet.service.ts'],
    message: 'Direct user balance update must only occur in wallet.service.ts',
  },
  // Inline numeric literals in service layer (not in config/services)
  {
    pattern: /\b[0-9]+(\.[0-9]+)?\b/,
    allowFiles: ['config', 'services'],
    restrictTo: /service\.ts$/,
    message: 'Inline numeric literals are forbidden in service layer; use config/services only',
  },
];

function walk(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      walk(filepath, filelist);
    } else {
      filelist.push(filepath);
    }
  });
  return filelist;
}

function checkFile(file, rules) {
  const rel = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of rules) {
    if (rule.restrictTo && !rule.restrictTo.test(file)) continue;
    if (rule.allowFiles && rule.allowFiles.some(f => rel.endsWith(f) || rel.includes(f))) continue;
    if (rule.allowFiles && rule.allowFiles.some(f => rel.includes(f))) continue;
    if (rule.pattern.test(content)) {
      return rule.message + `\nFile: ${rel}`;
    }
  }
  return null;
}

function main() {
  const files = walk(path.join(ROOT, 'src'));
  let failed = false;
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const err = checkFile(file, forbiddenPatterns);
    if (err) {
      console.error('PRE-RELEASE BLOCKER:', err);
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  } else {
    console.log('Pre-release stabilization check: PASS');
  }
}

if (require.main === module) {
  main();
}
