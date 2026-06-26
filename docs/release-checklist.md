# Release Checklist

Use this before TestFlight, Android internal testing, or store submission.

## App Identity

- App name: `Battle of the Bands`
- iOS bundle identifier: `com.battlebands.app`
- Android package name: `com.battlebands.app`
- App version: `1.0.0`
- iOS build number: `1`
- Android version code: `1`

Change bundle/package identifiers before the first store submission if you want a different permanent ID.

## Required Technical Checks

```bash
npm run setup:check
npm run check:platform
npm run check:build
npm run verify
```

For shared-room release testing, also run:

```bash
npm run setup:live
```

For real Spotify search, also run:

```bash
npm run setup:spotify
```

## Privacy Notes

The current app may process:

- display names entered by room members
- room codes and invite links
- Spotify artist/album search queries
- Spotify album metadata and artwork URLs
- battle votes and battle history

Before public release, prepare:

- a privacy policy URL
- a support/contact URL
- store data-safety answers for Supabase room data
- store data-safety answers for Spotify search data
- terms for Spotify playback/search behavior

Draft starting points are available in:

- `docs/privacy-policy-draft.md`
- `docs/support-draft.md`

## Store Assets

Prepare:

- app icon review
- splash screen review
- iPhone screenshots
- Android phone screenshots
- short app description
- full app description
- keywords/categories

## Build Commands

Android internal APK:

```bash
npx eas build --profile preview --platform android
```

iOS internal/TestFlight build:

```bash
npx eas build --profile preview --platform ios
```

Production builds:

```bash
npx eas build --profile production --platform android
npx eas build --profile production --platform ios
```
