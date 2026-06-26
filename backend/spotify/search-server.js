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
  if (request.method !== 'GET' || url.pathname !== '/spotify/search') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  const query = url.searchParams.get('q')?.trim() ?? '';
  if (!query) {
    sendJson(response, 200, { results: [] });
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
    const spotifyResponse = await fetch(
      `https://api.spotify.com/v1/search?${new URLSearchParams({
        q: query,
        type: 'album',
        limit: '10',
      })}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!spotifyResponse.ok) {
      const message = await spotifyResponse.text();
      sendJson(response, spotifyResponse.status, { error: message });
      return;
    }

    const data = await spotifyResponse.json();
    const results = (data.albums?.items ?? []).map(toMusicPick);
    sendJson(response, 200, { results });
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
