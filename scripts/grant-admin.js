// One-off script: grant the `admin` custom claim to a Firebase Auth user.
//
// Setup (once):
//   1. https://console.firebase.google.com/project/roamerz-b0056/settings/serviceaccounts/adminsdk
//   2. Click "Generate new private key" → save the JSON anywhere; the script
//      auto-detects `service-account.json` at repo root or any
//      `firebase/*-firebase-adminsdk-*.json`. You can also pass --key=<path>.
//
// Usage:
//   node scripts/grant-admin.js <email>
//   node scripts/grant-admin.js <email> --key=path/to/key.json
//
// After running, sign out and back in on the web app — the new ID token will
// include `role: 'admin'` and the AuthContext will let you in.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function findServiceAccount() {
  const explicit = process.argv.find((a) => a.startsWith('--key='));
  if (explicit) return resolve(repoRoot, explicit.slice('--key='.length));

  const rootCandidate = resolve(repoRoot, 'service-account.json');
  if (existsSync(rootCandidate)) return rootCandidate;

  const firebaseDir = resolve(repoRoot, 'firebase');
  if (existsSync(firebaseDir)) {
    const adminsdk = readdirSync(firebaseDir).find((f) => /-firebase-adminsdk-.*\.json$/.test(f));
    if (adminsdk) return resolve(firebaseDir, adminsdk);
  }
  return null;
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const email = args[0];
if (!email) {
  console.error('Usage: node scripts/grant-admin.js <email> [--key=path/to/key.json]');
  process.exit(1);
}

const keyPath = findServiceAccount();
if (!keyPath) {
  console.error('Could not find a service account JSON.');
  console.error('Looked for:');
  console.error('  - service-account.json at repo root');
  console.error('  - firebase/*-firebase-adminsdk-*.json');
  console.error('Or pass --key=<path>.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch (err) {
  console.error(`Could not read ${keyPath}`);
  console.error(err.message);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const user = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(user.uid, { role: 'admin' });
await auth.revokeRefreshTokens(user.uid);

console.log(`✓ Granted admin to ${email} (uid: ${user.uid})`);
console.log(`  Used key: ${keyPath}`);
console.log('Sign out and back in on the web app to pick up the new claim.');
