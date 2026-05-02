// Deploys storage.rules via the Firebase Rules REST API, mirroring
// `.deploy-firestore-rules.mjs`. Auth is the same service account
// (GOOGLE_APPLICATION_CREDENTIALS).
//
// The release name for Storage rules is `firebase.storage/{bucket}` where
// bucket is the canonical default bucket of the project. The Admin SDK
// project metadata exposes the bucket as `<projectId>.appspot.com`.
//
// If the service account lacks the `firebaserules.releases.update` scope on
// the storage release, the PATCH will 403. We log the error verbatim and
// exit 1 so callers see the failure.

import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'node:fs';

const project = process.argv[2];
const rulesPath = process.argv[3];
const explicitBucket = process.argv[4]; // optional override

if (!project || !rulesPath) {
  console.error('Usage: node deploy-storage-rules.mjs <projectId> <rulesPath> [bucket]');
  process.exit(2);
}

const source = readFileSync(rulesPath, 'utf8');
const bucket = explicitBucket || `${project}.appspot.com`;

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();

async function api(method, path, body) {
  const url = `https://firebaserules.googleapis.com${path}`;
  const res = await client.request({ url, method, data: body });
  return res.data;
}

console.log(`Creating storage ruleset for project=${project}, bucket=${bucket}…`);
const ruleset = await api('POST', `/v1/projects/${project}/rulesets`, {
  source: { files: [{ name: 'storage.rules', content: source }] },
});
console.log('  ruleset:', ruleset.name);

const releaseName = `projects/${project}/releases/firebase.storage/${bucket}`;
console.log(`Releasing ${releaseName}…`);
try {
  await api('PATCH', `/v1/${releaseName}`, {
    release: { name: releaseName, rulesetName: ruleset.name },
    updateMask: 'rulesetName',
  });
  console.log('  released (PATCH).');
} catch (err) {
  if (err.response?.status === 404) {
    try {
      await api('POST', `/v1/projects/${project}/releases`, {
        name: releaseName,
        rulesetName: ruleset.name,
      });
      console.log('  released (POST, first time).');
    } catch (postErr) {
      console.error(
        '\nStorage Rules release failed (POST). The service account likely lacks',
      );
      console.error('the `firebaserules.releases.create` permission for the storage');
      console.error('release. Run `firebase deploy --only storage` from a logged-in');
      console.error('shell as a workaround.\n');
      console.error(postErr.response?.data ?? postErr.message);
      process.exit(1);
    }
  } else {
    console.error(
      '\nStorage Rules release failed (PATCH). The service account likely lacks',
    );
    console.error('the `firebaserules.releases.update` permission for the storage');
    console.error('release. Run `firebase deploy --only storage` from a logged-in');
    console.error('shell as a workaround.\n');
    console.error(err.response?.data ?? err.message);
    process.exit(1);
  }
}

console.log('\n✅ Storage rules deployed.');
