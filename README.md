# Battle of the Bands

This is an Expo React Native music app prototype for Android and iOS.

Current platform target:

- iOS 15.1+ through Expo SDK 54
- Android 7+ through Expo SDK 54
- Expo Go SDK 54 for quick device testing

Friends add up to 500 favourite Spotify artists and albums to one shared list. When the battle starts, the app randomly picks two available bands, lets the group play the music through Spotify, then vote. The loser is eliminated, the favourite stays available for future random battles, and the app repeats this until one band or album is left as the winner.

## Run locally

```bash
npm start
```

Then scan the QR code with Expo Go on your phone.

## Run On iPhone

1. Install **Expo Go** from the iOS App Store.
2. Put your iPhone and this computer on the same Wi-Fi network.
3. Start the Expo dev server:

```bash
npm run iphone
```

4. Scan the QR code shown in the terminal with the iPhone Camera app.
5. Open the link in Expo Go.

If the QR code does not connect, run:

```bash
npm start -- --tunnel
```

Tunnel mode is slower, but it often works when Wi-Fi/network discovery is being fussy.

## Platform commands

```bash
npm run android
npm run ios
npm run web
npm run iphone
```

`npm run ios` requires macOS for the iOS simulator. On Windows, use Expo Go on an iPhone for quick iOS testing.

## Installable builds

The project includes `eas.json` profiles for later iOS and Android builds:

```bash
npm run check:build
npx eas build --profile preview --platform android
npx eas build --profile preview --platform ios
```

Use the `preview` profile for internal test installs. Use the `production` profile when preparing store builds.

Native app identifiers are currently:

- iOS bundle identifier: `com.battlebands.app`
- Android package name: `com.battlebands.app`
- App version: `1.0.0`
- iOS build number: `1`
- Android version code: `1`

Change these before the first store submission if you want a different permanent app ID.

For the release readiness checklist, see `docs/release-checklist.md`.

## Verification

To check whether the app is still in local/mock mode or ready for shared phone testing:

```bash
npm run setup:check
```

After adding real Supabase credentials to `.env`, run:

```bash
npm run setup:live
```

That checks the Supabase REST tables the app needs for shared rooms. If `EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT` is set, it also checks the Spotify search endpoint.

For the full two-phone setup checklist, see `docs/shared-room-setup.md`.

To check real Spotify search after configuring the backend endpoint:

```bash
npm run setup:spotify
```

For the full Spotify setup checklist, see `docs/spotify-setup.md`.

To check the iOS/Android app configuration:

```bash
npm run check:platform
npm run check:build
```

```bash
npm run verify
```

Or run the checks individually:

```bash
npm run smoke:local
npm run smoke:random
npm run smoke:playback
npm run smoke:invite
npm run smoke:share
npm run smoke:supabase
npm run setup:spotify
npm run check:platform
npm run check:build
npx tsc --noEmit
node --check backend/spotify/search-server.js
```

The local smoke test covers room creation, joining, adding picks, the 500-band room limit, random elimination battles, voting to a winner, structured battle history, and resetting the battle.
The random match smoke test covers deterministic random pair selection and prevents duplicate picks in one matchup.
The playback smoke test covers Spotify URI to web fallback URL conversion.
The invite smoke test covers room-code and `battlebands://join?code=...` parsing.
The share smoke test covers final winner result-message formatting.
The Supabase schema smoke test covers the 500-band database cap and random match advancement contract.
The platform check covers Expo SDK pairing, iOS/Android app config, deep-link scheme, music theme, and required icon assets.
The build check covers EAS development, preview, and production build profiles.

## Main files

- `App.tsx`: first screen and styles
- `src/types.ts`: shared room, member, pick, and vote types
- `src/roomStore.ts`: local room operations shaped like a future backend API
- `src/randomMatch.ts`: pure random pair selection helper
- `src/roomRepository.ts`: async repository interface for local or backend room data
- `src/backend/supabaseConfig.ts`: Expo public environment variable reader
- `src/backend/supabaseRepository.ts`: first Supabase repository adapter skeleton
- `src/backend/roomRepositoryFactory.ts`: chooses local or Supabase room storage
- `src/backend/spotifySearchFactory.ts`: chooses mock or backend Spotify search
- `src/spotifySearchService.ts`: Spotify search service interface
- `src/spotifyPlayback.ts`: opens Spotify app links with web fallback
- `src/spotifyUrls.ts`: pure Spotify URL conversion helpers
- `src/inviteLinks.ts`: room invite link creation and parsing
- `src/shareMessages.ts`: room invite and winner share-sheet message formatting
- `src/mockSpotify.ts`: mock Spotify catalog search
- `backend/spotify/search-server.js`: local Spotify Search API backend
- `backend/spotify/.env.example`: backend-only Spotify credential template
- `scripts/smoke-local-room.js`: automated local room/battle smoke test
- `scripts/smoke-random-match.js`: automated random-pair helper smoke test
- `scripts/smoke-playback.js`: automated Spotify playback URL smoke test
- `scripts/smoke-invite-links.js`: automated invite-link smoke test
- `scripts/smoke-share-message.js`: automated invite and winner share-message smoke test
- `scripts/smoke-supabase-schema.js`: automated Supabase schema contract smoke test
- `scripts/check-setup.js`: reports whether Supabase and Spotify search are configured
- `scripts/check-live-backend.js`: checks real Supabase and Spotify endpoints after credentials are added
- `scripts/check-spotify-search.js`: checks the configured Spotify search endpoint
- `scripts/check-platform-compat.js`: checks iOS/Android Expo config and required assets
- `scripts/check-build-config.js`: checks EAS build profiles for installable app builds
- `eas.json`: EAS Build profiles for development, preview, and production
- `render.yaml`: Render blueprint for deploying the Spotify search backend
- `docs/shared-room-setup.md`: checklist for Supabase-backed two-phone room testing
- `docs/spotify-setup.md`: checklist for real Spotify search setup
- `docs/render-deploy.md`: Render deployment steps for the Spotify search backend
- `docs/release-checklist.md`: checklist for TestFlight, Android internal testing, and store readiness
- `docs/privacy-policy-draft.md`: draft privacy policy notes for review before release
- `docs/support-draft.md`: draft support page notes for review before release
- `backend/supabase/schema.sql`: first-pass database schema for real rooms and votes
- `backend/spotify-search-endpoint.md`: backend contract for real Spotify search
- `.env.example`: Supabase environment variable template
- `app.json`: Expo app configuration
- `assets/`: icons and splash assets

## Current prototype

- Create or join a local battle room with a room code
- Modern music dark theme with stage-style panels and Spotify-green accents
- Enter a display name before creating or joining a room
- Show real room members and the host
- Share a room code through the native Android/iOS share sheet
- Share messages include a `battlebands://join?code=...` invite link
- Opening an invite link pre-fills the join code on the home screen
- New rooms use six-digit codes like `BAND-482193` to reduce collisions
- Join accepts pasted invites, `BAND-482193`, `band482193`, or just `482193`
- Leave a room locally without resetting the shared battle
- Host-only controls for starting and resetting battles
- Start battle controls explain why the room is not ready yet
- Mock Spotify search results, or backend Spotify search when configured
- Album artwork from Spotify search results when available
- One shared friend list per room
- Add/remove up to 500 music picks before a battle starts
- Show room capacity with spots left and a 500-band progress meter
- Preview large room lists without rendering all 500 bands at once on the phone
- Search/filter the shared list by artist, album, or friend who added it
- Randomly pick two still-available bands for each battle
- Keep voted favourites available for later battles until only one winner remains
- Majority voting for each head-to-head battle
- Vote progress shows who has voted, who is still waiting, and how many votes are needed
- Host-only tiebreaker when everyone has voted and no band reaches majority
- Live battle progress with alive, eliminated, round, and recent history stats
- The current user can only cast their own vote for each matchup
- Winner screen with searchable battle history
- Share the final winner and recent battle results through the native share sheet
- Structured battle history records round number, winner, loser, vote score, and summary
- Spotify buttons open the Spotify app URI and fall back to the Spotify web player
- Backend-ready local room store for create, join, add, remove, start, vote, and reset actions
- Async room repository interface ready for a Supabase or Firebase adapter
- Supabase rooms can be manually refreshed and are polled while active
- Local rooms are shared in memory by room code during the running app session

## Spotify production work

To turn this into real Spotify playback, add:

- Spotify OAuth login
- Spotify catalog search for artists, albums, and tracks through a backend endpoint
- Spotify deep links or App Remote playback on mobile
- Spotify Web Playback SDK for browser playback
- A backend for rooms, friends, shared lists, vote state, and access-token handling

Set `EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT` to use backend Spotify search. Without it, the app uses the built-in mock catalog.

Playback uses Spotify deep links first, then falls back to `https://open.spotify.com/...` links when the app URI cannot be opened.

This repo includes a local Spotify search backend:

```bash
npm run spotify:search
```

That backend requires `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the backend process environment. Do not put the Spotify client secret in Expo public env vars.

## Backend direction

The app now calls an async `RoomRepository` interface. The current implementation is local and instant, but a Supabase-backed version can use the same method names:

- `createRoom`
- `joinRoom`
- `addPick`
- `removePick`
- `startBattle`
- `castVote`
- `resetBattle`
- `reloadRoom`

Leaving a room only returns the current device to the home screen. `resetBattle` is the host-only action that clears the shared battle state.

The first Supabase schema is in `backend/supabase/schema.sql`.

The Supabase adapter is in `src/backend/supabaseRepository.ts`. It can create rooms with a host member, add friends when they join, hydrate members/picks/matches/votes, add picks, remove picks, start battles, cast votes, advance rounds, complete battles, and reset battles.

Vote counting and round advancement are handled by the `public.cast_match_vote` Supabase RPC in `backend/supabase/schema.sql`, so simultaneous votes are resolved inside the database.

The Supabase schema includes Row Level Security policies for the current invite-code model. Before a public launch, add Supabase Auth user IDs to room members and tighten policies around each authenticated user.

The app uses `src/backend/roomRepositoryFactory.ts` to choose storage:

- No Supabase env vars: uses the local in-memory prototype
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set: uses the Supabase adapter

When Supabase mode is active, the app reloads the room every 5 seconds while the user is inside a room. The header also has a manual refresh action.

Create a local `.env` from `.env.example` when you have a Supabase project:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT=https://your-api.example.com/spotify/search
```

## Voting rules

- Every room member gets one vote per matchup
- Each device/session votes as the joined room member
- Only the host can start a battle or run another battle after a winner
- A pick advances when it reaches a majority
- Majority is based on the current number of room members
- The round winner faces the next pick until one final winner remains
