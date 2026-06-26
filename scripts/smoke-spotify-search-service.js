const assert = require('node:assert/strict');
require('./register-ts');

const { createBackendSpotifySearchService } = require('../src/spotifySearchService.ts');

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;

(async () => {
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(url.toString());
    return {
    ok: true,
      json: async () => {
        if (url.toString().includes('/spotify/artists/artist-1/albums')) {
          return {
            albums: [
              {
                id: 'spotify:album:test',
                artist: 'Test Artist',
                album: 'Test Album',
                addedBy: 'Spotify',
                spotifyUrl: 'spotify:album:test',
                albumId: 'album-1',
              },
            ],
          };
        }

        if (url.toString().includes('/spotify/albums/album-1/tracks')) {
          return {
            tracks: [
              {
                id: 'spotify:track:test',
                artist: 'Test Artist',
                album: 'Test Song (Test Album)',
                addedBy: 'Spotify',
                spotifyUrl: 'spotify:track:test',
                albumId: 'album-1',
                trackNumber: 1,
              },
            ],
          };
        }

        if (url.toString().includes('/spotify/artists')) {
          return {
            artists: [
              {
                id: 'artist-1',
                name: 'Test Artist',
                spotifyUrl: 'spotify:artist:artist-1',
              },
            ],
          };
        }

        return {
          results: [
            {
              id: 'spotify:album:test',
              artist: 'Test Artist',
              album: 'Test Album',
              addedBy: 'Spotify',
              spotifyUrl: 'spotify:album:test',
            },
          ],
        };
      },
    };
  };

  const service = createBackendSpotifySearchService('https://example.com/spotify/search');
  const results = await service.search('queen');
  assert.equal(results.length, 1);
  assert.equal(results[0].artist, 'Test Artist');
  assert.equal(requestedUrls[0], 'https://example.com/spotify/search?q=queen');

  const artists = await service.searchArtists('queen');
  assert.equal(artists[0].name, 'Test Artist');
  assert.equal(requestedUrls[1], 'https://example.com/spotify/artists?q=queen');

  const albums = await service.getArtistAlbums('artist-1');
  assert.equal(albums[0].albumId, 'album-1');
  assert.equal(requestedUrls[2], 'https://example.com/spotify/artists/artist-1/albums');

  const tracks = await service.getAlbumTracks('album-1');
  assert.equal(tracks[0].trackNumber, 1);
  assert.equal(requestedUrls[3], 'https://example.com/spotify/albums/album-1/tracks');

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
