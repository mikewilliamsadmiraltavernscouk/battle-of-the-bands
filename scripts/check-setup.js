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
  if (!value) {
    return false;
  }

  return !placeholders.some((placeholder) => value.includes(placeholder));
}

function isUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function looksLikeJwt(value) {
  return value.split('.').length === 3;
}

const appEnv = readEnvFile('.env');
const spotifyEnv = readEnvFile('backend/spotify/.env');
const envFiles = [appEnv, spotifyEnv];

const supabaseUrl = valueFrom(envFiles, 'EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = valueFrom(envFiles, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
const spotifySearchEndpoint = valueFrom(envFiles, 'EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT');
const spotifyClientId = valueFrom(envFiles, 'SPOTIFY_CLIENT_ID');
const spotifyClientSecret = valueFrom(envFiles, 'SPOTIFY_CLIENT_SECRET');

const checks = [
  {
    label: 'Shared rooms',
    ready:
      isRealValue(supabaseUrl, ['your-project']) &&
      isUrl(supabaseUrl) &&
      isRealValue(supabaseAnonKey, ['your-public-anon-key']) &&
      looksLikeJwt(supabaseAnonKey),
    readyText: 'Supabase URL and anon key are configured.',
    nextText: 'Add a valid EXPO_PUBLIC_SUPABASE_URL and anon JWT key to .env.',
  },
  {
    label: 'Spotify search in the app',
    ready: isRealValue(spotifySearchEndpoint, ['your-api.example.com']) && isUrl(spotifySearchEndpoint),
    readyText: 'The app has a Spotify search endpoint.',
    nextText: 'Add a valid EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT URL to .env.',
  },
  {
    label: 'Spotify backend credentials',
    ready:
      isRealValue(spotifyClientId, ['your-spotify-client-id']) &&
      isRealValue(spotifyClientSecret, ['your-spotify-client-secret']),
    readyText: 'The backend has Spotify client credentials.',
    nextText: 'Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to backend/spotify/.env.',
  },
];

console.log('Battle of the Bands setup check');
console.log('');

for (const check of checks) {
  console.log(`${check.ready ? '[ready]' : '[todo]'} ${check.label}`);
  console.log(`  ${check.ready ? check.readyText : check.nextText}`);
}

console.log('');

if (checks.every((check) => check.ready)) {
  console.log('Ready for live room testing with real Spotify search.');
} else {
  console.log('The app can still run in local/mock mode while these are unfinished.');
}
