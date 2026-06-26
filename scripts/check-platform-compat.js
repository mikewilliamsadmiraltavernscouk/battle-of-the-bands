const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
const expo = appJson.expo;

assert.equal(packageJson.dependencies.expo, '~54.0.0', 'Expo SDK should stay on 54 for the current Expo Go target.');
assert.equal(packageJson.dependencies.react, '19.1.0', 'React should match Expo SDK 54.');
assert.equal(packageJson.dependencies['react-native'], '0.81.5', 'React Native should match Expo SDK 54.');

assert.equal(expo.name, 'Battle of the Bands');
assert.equal(expo.scheme, 'battlebands', 'Deep-link scheme is required for room invites.');
assert.equal(expo.orientation, 'portrait', 'The current phone UI is designed for portrait use.');
assert.equal(expo.userInterfaceStyle, 'dark', 'The app is currently designed with a modern music dark theme.');

assert.ok(expo.ios, 'iOS config is required.');
assert.equal(expo.ios.bundleIdentifier, 'com.battlebands.app', 'iOS bundle identifier is required for builds.');
assert.equal(expo.ios.supportsTablet, true, 'iOS tablet support should remain explicit.');
assert.ok(expo.android, 'Android config is required.');
assert.equal(expo.android.package, 'com.battlebands.app', 'Android package name is required for builds.');
assert.ok(expo.android.adaptiveIcon, 'Android adaptive icon config is required.');
assert.equal(expo.android.predictiveBackGestureEnabled, false, 'Android predictive back is disabled for this prototype.');

const requiredAssets = [
  expo.icon,
  expo.android.adaptiveIcon.foregroundImage,
  expo.android.adaptiveIcon.backgroundImage,
  expo.android.adaptiveIcon.monochromeImage,
  expo.web.favicon,
];

for (const asset of requiredAssets) {
  assert.ok(existsSync(join(root, asset)), `Missing app asset: ${asset}`);
}

console.log('Platform compatibility check passed.');
console.log('Target: Expo SDK 54, iOS 15.1+, Android 7+.');
