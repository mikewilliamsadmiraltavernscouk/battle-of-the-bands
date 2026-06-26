const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const easPath = join(root, 'eas.json');

assert.ok(existsSync(easPath), 'eas.json is required for installable EAS builds.');

const eas = JSON.parse(readFileSync(easPath, 'utf8'));
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

assert.ok(eas.cli, 'eas.json must include a cli section.');
assert.ok(eas.build?.development, 'development build profile is required.');
assert.ok(eas.build?.preview, 'preview build profile is required.');
assert.ok(eas.build?.production, 'production build profile is required.');
assert.equal(eas.build.development.developmentClient, true, 'development profile should create a dev client.');
assert.equal(eas.build.preview.distribution, 'internal', 'preview profile should be internal distribution.');
assert.equal(eas.build.preview.android.buildType, 'apk', 'preview Android builds should produce APKs for easy testing.');
assert.equal(eas.build.production.android.buildType, 'app-bundle', 'production Android builds should produce AABs.');
assert.equal(eas.build.production.autoIncrement, true, 'production builds should auto-increment versions.');

assert.ok(app.name, 'Expo app name is required.');
assert.ok(app.slug, 'Expo app slug is required.');
assert.ok(app.version, 'Expo app version is required.');
assert.match(app.version, /^\d+\.\d+\.\d+$/, 'Expo app version should use semantic versioning, such as 1.0.0.');
assert.ok(app.icon, 'Expo app icon is required.');
assert.ok(app.ios, 'iOS app config is required.');
assert.ok(app.ios.bundleIdentifier, 'iOS bundle identifier is required for EAS builds.');
assert.ok(app.ios.buildNumber, 'iOS buildNumber is required for EAS builds.');
assert.ok(app.android, 'Android app config is required.');
assert.ok(app.android.package, 'Android package name is required for EAS builds.');
assert.equal(typeof app.android.versionCode, 'number', 'Android versionCode is required for EAS builds.');

console.log('Build configuration check passed.');
console.log('Profiles: development, preview, production.');
