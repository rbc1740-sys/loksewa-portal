/**
 * Sanity check for google-services.json before wiring up Google sign-in.
 *
 * Verifies:
 *  - the expected Android package name is present
 *  - an api_key exists
 *  - an Android OAuth client (client_type 1) is registered - REQUIRED for the
 *    native custom-scheme sign-in flow in src/services/auth.ts
 *
 * Usage:  node scripts/check-google-services.js [path-to-google-services.json]
 */
const fs = require('fs');
const path = require('path');

const EXPECTED_PACKAGE = 'com.loksewa.preppro';
const TYPE_LABELS = { 1: 'Android', 2: 'iOS', 3: 'Web' };

const file =
  process.argv[2] || path.resolve(__dirname, '..', 'google-services.json');

if (!fs.existsSync(file)) {
  console.error('[FAIL] File not found:', file);
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log('File       :', file);
console.log('Project    :', cfg.project_info && cfg.project_info.project_id);

let ok = true;
let androidClientFound = false;

for (const client of cfg.client || []) {
  const pkg =
    client.client_info &&
    client.client_info.android_client_info &&
    client.client_info.android_client_info.package_name;

  console.log('\nApp        :', pkg);
  console.log('  app_id   :', client.client_info.mobilesdk_app_id);

  if (pkg !== EXPECTED_PACKAGE) {
    console.log(`  [FAIL] unexpected package (expected ${EXPECTED_PACKAGE})`);
    ok = false;
  }

  const apiKey = client.api_key && client.api_key[0] && client.api_key[0].current_key;
  if (!apiKey) {
    console.log('  [FAIL] no api_key present');
    ok = false;
  } else {
    console.log('  api_key  :', `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}`);
  }

  const oauth = client.oauth_client || [];
  if (oauth.length === 0) {
    console.log('  [FAIL] no oauth_client entries - Google sign-in cannot work');
    ok = false;
  }

  for (const o of oauth) {
    const label = TYPE_LABELS[o.client_type] || `type ${o.client_type}`;
    console.log(`  oauth ${label.padEnd(8)}: ${o.client_id}`);
    if (Number(o.client_type) === 1) {
      androidClientFound = true;
      console.log('           ^ Android OAuth client present [OK]');
    }
  }
}

console.log('');
if (!androidClientFound) {
  console.log('[FAIL] No Android OAuth client (client_type 1) found.');
  console.log('       Native Google sign-in needs one bound to package');
  console.log(`       "${EXPECTED_PACKAGE}" + your keystore SHA-1.`);
  console.log('       Create it at: https://console.cloud.google.com/apis/credentials');
  console.log('       (Application type MUST be "Android", not "Desktop app").');
  console.log('       Then re-download google-services.json and re-run this script.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('[OK] google-services.json is ready for Google sign-in.');
