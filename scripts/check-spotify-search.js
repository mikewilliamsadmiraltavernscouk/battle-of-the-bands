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

function assertUrl(value, label) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
}

async function main() {
  const appEnv = readEnvFile('.env');
  const spotifyEnv = readEnvFile('backend/spotify/.env');
  const endpoint = valueFrom([appEnv, spotifyEnv], 'EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT');

  console.log('Battle of the Bands Spotify search check');
  console.log('');

  if (!isRealValue(endpoint, ['your-api.example.com'])) {
    throw new Error('EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT is not configured. Add it to .env after starting or deploying the Spotify backend.');
  }

  const url = assertUrl(endpoint, 'EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT');
  url.searchParams.set('q', 'radiohead');

  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify search endpoint failed: ${response.status} ${message}`);
  }

  const body = await response.json();
  if (!Array.isArray(body.results)) {
    throw new Error('Spotify search endpoint did not return a results array.');
  }

  console.log(`[ready] Spotify search endpoint returned ${body.results.length} results.`);
}

main().catch((error) => {
  console.error('[failed] Spotify search check failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
