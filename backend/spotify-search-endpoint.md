# Spotify Search Endpoint Contract

The mobile app can use real Spotify search when this environment variable is set:

```bash
EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT=https://your-api.example.com/spotify/search
```

The endpoint keeps Spotify client credentials and access tokens off the device.

This repo includes a dependency-free local implementation at `backend/spotify/search-server.js`.

Run it with:

```bash
SPOTIFY_CLIENT_ID=your-client-id SPOTIFY_CLIENT_SECRET=your-client-secret npm run spotify:search
```

On Windows PowerShell:

```powershell
$env:SPOTIFY_CLIENT_ID='your-client-id'
$env:SPOTIFY_CLIENT_SECRET='your-client-secret'
npm run spotify:search
```

Then set the app endpoint:

```bash
EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT=http://localhost:8787/spotify/search
```

## Request

```http
GET /spotify/search?q=radiohead
```

## Response

```json
{
  "results": [
    {
      "id": "spotify:album:6dVIqQ8qmQ5GBnJ9shOYGE",
      "artist": "Radiohead",
      "album": "OK Computer",
      "addedBy": "Spotify",
      "spotifyUrl": "spotify:album:6dVIqQ8qmQ5GBnJ9shOYGE",
      "artworkUrl": "https://i.scdn.co/image/..."
    }
  ]
}
```

The app expects `results` to be an array of `MusicPick` objects.
`artworkUrl` is optional, but recommended for album results.

`spotifyUrl` may be either a Spotify URI such as `spotify:album:...` or a public Spotify URL. The mobile app tries the URI first and can fall back to `https://open.spotify.com/...` links.

## Backend responsibilities

- Authenticate with Spotify using server-side credentials.
- Search Spotify albums, artists, or tracks.
- Normalize Spotify responses into the `MusicPick` shape.
- Return only public catalog metadata to the app.
- Never expose the Spotify client secret to Expo public environment variables.
