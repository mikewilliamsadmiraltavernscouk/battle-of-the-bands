const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const requiredDocs = [
  'docs/release-checklist.md',
  'docs/privacy-policy-draft.md',
  'docs/support-draft.md',
  'docs/shared-room-setup.md',
  'docs/spotify-setup.md',
];

for (const doc of requiredDocs) {
  const path = join(root, doc);
  assert.ok(existsSync(path), `Missing release document: ${doc}`);
  assert.ok(readFileSync(path, 'utf8').trim().length > 0, `Release document is empty: ${doc}`);
}

console.log('Release documents check passed.');
