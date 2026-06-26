# Spotify Setup

Use this when you are ready to replace mock search with real Spotify album search.

## 1. Create Spotify Credentials

1. Create a Spotify developer app.
2. Copy the client ID and client secret.
3. Keep the client secret server-side only.

## 2. Configure The Backend

Create `backend/spotify/.env`:

```bash
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
PORT=8787
```

Start the local backend:

```bash
npm run spotify:search
```

The local endpoint is:

```text
http://localhost:8787/spotify/search
```

For testing on a real phone, the endpoint must be reachable from the phone. A deployed HTTPS endpoint is best. Localhost only works from the computer, not from the iPhone or Android device.

## 3. Configure The App

Add this to `.env`:

```bash
EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT=https://your-api.example.com/spotify/search
```

Restart Expo after changing `.env`.

## 4. Check Spotify Search

```bash
npm run setup:spotify
```

The check calls the configured endpoint with a test query and verifies it returns a `results` array.

## 5. Playback Note

The app currently opens Spotify links through the Spotify app first, then falls back to the Spotify web player. Full in-app playback control will require Spotify OAuth and a playback integration later.
