const http = require('node:http');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

loadLocalEnv();

const port = Number(process.env.PORT ?? 8787);
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  if (request.method !== 'GET') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  if (!clientId || !clientSecret) {
    sendJson(response, 500, {
      error: 'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set on the backend.',
    });
    return;
  }

  try {
    const accessToken = await getAccessToken();

    if (url.pathname === '/spotify/search') {
      const query = url.searchParams.get('q')?.trim() ?? '';
      if (!query) {
        sendJson(response, 200, { results: [] });
        return;
      }

      const data = await spotifyFetch(accessToken, '/v1/search', {
        q: query,
        type: 'album',
        limit: '10',
      });
      sendJson(response, 200, { results: (data.albums?.items ?? []).map(toMusicPick) });
      return;
    }

    if (url.pathname === '/spotify/artists') {
      const query = url.searchParams.get('q')?.trim() ?? '';
      if (!query) {
        sendJson(response, 200, { artists: [] });
        return;
      }

      const data = await spotifyFetch(accessToken, '/v1/search', {
        q: query,
        type: 'artist',
        limit: '10',
      });
      sendJson(response, 200, { artists: (data.artists?.items ?? []).map(toArtist) });
      return;
    }

    const artistAlbumsMatch = url.pathname.match(/^\/spotify\/artists\/([^/]+)\/albums$/);
    if (artistAlbumsMatch) {
      const artistId = decodeURIComponent(artistAlbumsMatch[1]);
      const data = await spotifyFetch(accessToken, `/v1/artists/${encodeURIComponent(artistId)}/albums`, {
        include_groups: 'album,single',
        market: 'GB',
        limit: '30',
      });
      sendJson(response, 200, { albums: (data.items ?? []).map(toAlbumPick) });
      return;
    }

    const albumTracksMatch = url.pathname.match(/^\/spotify\/albums\/([^/]+)\/tracks$/);
    if (albumTracksMatch) {
      const albumId = decodeURIComponent(albumTracksMatch[1]);
      const album = await spotifyFetch(accessToken, `/v1/albums/${encodeURIComponent(albumId)}`, {
        market: 'GB',
      });
      sendJson(response, 200, { tracks: (album.tracks?.items ?? []).map((track) => toTrackPick(track, album)) });
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Spotify search failed.',
    });
  }
});

server.listen(port, () => {
  console.log(`Spotify search backend listening on http://localhost:${port}/spotify/search`);
});

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify token request failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max(0, Number(data.expires_in ?? 0) - 60) * 1000;

  return cachedToken;
}

async function spotifyFetch(accessToken, path, params = {}) {
  const query = new URLSearchParams(params);
  const url = `https://api.spotify.com${path}${query.size ? `?${query}` : ''}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify request failed: ${response.status} ${message}`);
  }

  return response.json();
}

function toMusicPick(album) {
  return {
    id: album.uri,
    artist: album.artists?.map((artist) => artist.name).join(', ') ?? 'Unknown artist',
    album: album.name,
    addedBy: 'Spotify',
    spotifyUrl: album.uri,
    artworkUrl: album.images?.[0]?.url,
  };
}

function toArtist(artist) {
  return {
    id: artist.id,
    name: artist.name,
    spotifyUrl: artist.uri,
    artworkUrl: artist.images?.[0]?.url,
  };
}

function toAlbumPick(album) {
  return {
    ...toMusicPick(album),
    albumId: album.id,
  };
}

function toTrackPick(track, album) {
  return {
    id: track.uri,
    artist: track.artists?.map((artist) => artist.name).join(', ') ?? album.artists?.map((artist) => artist.name).join(', ') ?? 'Unknown artist',
    album: `${track.name} (${album.name})`,
    addedBy: 'Spotify',
    spotifyUrl: track.uri,
    artworkUrl: album.images?.[0]?.url,
    albumId: album.id,
    trackNumber: track.track_number ?? 0,
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function loadLocalEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] = process.env[key] ?? value;
  }
}
