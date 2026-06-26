# Shared Room Setup

Use this when you are ready to test one battle room across two real phones.

## 1. Create Supabase

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `backend/supabase/schema.sql`.
4. Copy the project URL and anon public key.

Do not use the service-role key in the Expo app.

## 2. Configure Expo

Create `.env` in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-jwt-key
```

Restart Expo after changing `.env`.

## 3. Check Setup

```bash
npm run setup:check
npm run setup:live
```

`setup:check` validates local environment values. `setup:live` checks that the anon key can reach the Supabase tables the app needs.

## 4. Two-Phone Test

1. Start Expo with `npm run iphone` or `npm start -- --tunnel`.
2. Open the app on phone one.
3. Create a room and share the invite.
4. Open the invite on phone two.
5. Add music from both phones.
6. Start a battle from the host phone.
7. Vote from both phones and confirm both screens update after refresh or polling.

The app polls Supabase rooms every 5 seconds while inside a room.

## 5. Expected App Status

The home screen setup panel should show:

- Room storage: `Supabase connected`
- Spotify search: `Mock search results` unless the Spotify backend is configured

Mock Spotify search is enough for testing shared rooms and voting.
