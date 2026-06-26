const assert = require('node:assert/strict');
require('./register-ts');

const { createBackendSpotifySearchService } = require('../src/spotifySearchService.ts');

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;

(async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [
        {
          id: 'spotify:album:test',
          artist: 'Test Artist',
          album: 'Test Album',
          addedBy: 'Spotify',
          spotifyUrl: 'spotify:album:test',
        },
      ],
    }),
  });

  const service = createBackendSpotifySearchService('https://example.com/spotify/search');
  const results = await service.search('queen');
  assert.equal(results.length, 1);
  assert.equal(results[0].artist, 'Test Artist');

  global.setTimeout = (callback) => {
    callback();
    return 0;
  };
  global.fetch = async (_url, options) => {
    if (options?.signal?.aborted) {
      throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    }

    throw new Error('Expected abort signal.');
  };

  await assert.rejects(
    () => service.search('timeout'),
    /Spotify search timed out/,
  );

  console.log('Spotify search service smoke test passed.');
})()
  .finally(() => {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
  });
