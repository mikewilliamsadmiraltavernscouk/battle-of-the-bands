const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');

function readEnvFile(relativePath) {
  const envPath = join(root, relativePath);

  if (!existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function valueFrom(envFiles, key) {
  return process.env[key] ?? envFiles.find((env) => env[key])?.[key] ?? '';
}

function isRealValue(value, placeholders) {
  return Boolean(value) && !placeholders.some((placeholder) => value.includes(placeholder));
}

async function checkSupabaseTable(config, table) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${table}: ${response.status} ${message}`);
  }
}

async function checkSpotifySearch(endpoint) {
  const url = new URL(endpoint);
  url.searchParams.set('q', 'radiohead');

  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify search endpoint: ${response.status} ${message}`);
  }

  const body = await response.json();
  if (!Array.isArray(body.results)) {
    throw new Error('Spotify search endpoint did not return a results array.');
  }
}

async function main() {
  const appEnv = readEnvFile('.env');
  const spotifyEnv = readEnvFile('backend/spotify/.env');
  const envFiles = [appEnv, spotifyEnv];

  const supabaseUrl = valueFrom(envFiles, 'EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = valueFrom(envFiles, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const spotifySearchEndpoint = valueFrom(envFiles, 'EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT');

  const hasSupabase =
    isRealValue(supabaseUrl, ['your-project']) &&
    isRealValue(supabaseAnonKey, ['your-public-anon-key']);
  const hasSpotifySearch = isRealValue(spotifySearchEndpoint, ['your-api.example.com']);

  console.log('Battle of the Bands live backend check');
  console.log('');

  if (!hasSupabase) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.');
  }

  const tables = ['rooms', 'room_members', 'room_picks', 'battle_matches', 'match_votes'];
  for (const table of tables) {
    await checkSupabaseTable({ url: supabaseUrl, anonKey: supabaseAnonKey }, table);
    console.log(`[ready] Supabase table reachable: ${table}`);
  }

  if (hasSpotifySearch) {
    await checkSpotifySearch(spotifySearchEndpoint);
    console.log('[ready] Spotify search endpoint returned results.');
  } else {
    console.log('[todo] Spotify search endpoint is not configured; the app will use mock search.');
  }

  console.log('');
  console.log('Live backend is reachable for shared room testing.');
}

main().catch((error) => {
  console.error('[failed] Live backend check failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
