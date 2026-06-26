# Render Deploy

This deploys only the Spotify search backend. Supabase remains the room database.

## 1. Upload The Repo

Upload this project to the GitHub repo:

```text
battle-of-the-bands
```

Do not upload `.env` or `backend/spotify/.env`. They are ignored by `.gitignore`.

## 2. Create The Render Service

In Render:

1. Click **New**.
2. Choose **Blueprint** if using `render.yaml`, or **Web Service** for manual setup.
3. Connect the `battle-of-the-bands` repository.
4. Use the free instance type.

Manual settings:

```text
Build Command: npm install
Start Command: node backend/spotify/search-server.js
```

## 3. Add Environment Variables

Add these in Render:

```text
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
PORT=10000
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` let the Spotify backend cache artist album lists in Supabase. This reduces repeated Spotify requests and avoids rate-limit problems when several users select the same artist.

Before relying on this cache, run the latest `backend/supabase/schema.sql` in the Supabase SQL editor so the `spotify_artist_album_cache` table exists.

## 4. Test The Render URL

After deploy, test:

```text
https://your-render-service.onrender.com/spotify/search?q=queen
```

You should see JSON with a `results` array.

## 5. Update The App

Set this in the root `.env`:

```text
EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT=https://your-render-service.onrender.com/spotify/search
```

Restart Expo after changing `.env`.
