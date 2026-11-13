// Jana projek Android TWA (Trusted Web Activity) daripada twa/twa-manifest.json.
// Dijalankan oleh GitHub Actions (.github/workflows/android-apk.yml). Output: twa/android/
import { TwaManifest, TwaGenerator, ConsoleLog } from '@bubblewrap/core';
import fs from 'fs';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, 'android');
const json = JSON.parse(fs.readFileSync(path.join(here, 'twa-manifest.json'), 'utf8'));

const run = Number(process.env.GITHUB_RUN_NUMBER || 0);
json.appVersionCode = 100 + run;
json.appVersionName = json.appVersion = '1.0.' + run;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const manifest = new TwaManifest(json);
const errs = manifest.validate();
if (errs) { console.error('twa-manifest tidak sah:', errs); process.exit(1); }
await new TwaGenerator().createTwaProject(out, manifest, new ConsoleLog('twa'));
fs.writeFileSync(path.join(out, 'twa-manifest.json'), JSON.stringify(manifest.toJson(), null, 2));
console.log('Projek TWA dijana:', out, 'versi', json.appVersionName, '(' + json.appVersionCode + ')');
