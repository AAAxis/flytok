// Deploys firestore.rules by talking to the Firebase Rules REST API directly,
// bypassing firebase-tools's Service Usage preflight (which the
// firebase-adminsdk service account can't access by default).
//
// Auth: GOOGLE_APPLICATION_CREDENTIALS -> JWT -> access_token (cloud-platform)
// Endpoints:
//   POST /v1/projects/{p}/rulesets         -> create a ruleset, get its name
//   POST /v1/projects/{p}/releases/{r}     -> first release (release name = "cloud.firestore")
//   PATCH /v1/projects/{p}/releases/{r}    -> subsequent releases (re-point to new ruleset)

import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'node:fs';

const project = process.argv[2];
const rulesPath = process.argv[3];
if (!project || !rulesPath) {
  console.error('Usage: node deploy-firestore-rules.mjs <projectId> <rulesPath>');
  process.exit(2);
}

const source = readFileSync(rulesPath, 'utf8');

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();

async function api(method, path, body) {
  const url = `https://firebaserules.googleapis.com${path}`;
  const res = await client.request({ url, method, data: body });
  return res.data;
}

console.log(`Creating ruleset for project=${project}…`);
const ruleset = await api('POST', `/v1/projects/${project}/rulesets`, {
  source: { files: [{ name: 'firestore.rules', content: source }] },
});
console.log('  ruleset:', ruleset.name);

const releaseName = `projects/${project}/releases/cloud.firestore`;
console.log(`Releasing ${releaseName}…`);
// projects.releases.update takes an UpdateReleaseRequest:
// { release: Release, updateMask: "..." }
try {
  await api('PATCH', `/v1/${releaseName}`, {
    release: { name: releaseName, rulesetName: ruleset.name },
    updateMask: 'rulesetName',
  });
  console.log('  released (PATCH).');
} catch (err) {
  if (err.response?.status === 404) {
    await api('POST', `/v1/projects/${project}/releases`, {
      name: releaseName,
      rulesetName: ruleset.name,
    });
    console.log('  released (POST, first time).');
  } else {
    throw err;
  }
}

console.log('\n✅ Firestore rules deployed.');
