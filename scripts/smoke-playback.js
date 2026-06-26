const assert = require('node:assert/strict');
require('./register-ts');

const { toSpotifyWebUrl } = require('../src/spotifyUrls.ts');

assert.equal(
  toSpotifyWebUrl('spotify:album:6dVIqQ8qmQ5GBnJ9shOYGE'),
  'https://open.spotify.com/album/6dVIqQ8qmQ5GBnJ9shOYGE',
);
assert.equal(
  toSpotifyWebUrl('spotify:artist:4Z8W4fKeB5YxbusRsdQVPb'),
  'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb',
);
assert.equal(
  toSpotifyWebUrl('https://open.spotify.com/album/6dVIqQ8qmQ5GBnJ9shOYGE'),
  'https://open.spotify.com/album/6dVIqQ8qmQ5GBnJ9shOYGE',
);
assert.equal(toSpotifyWebUrl('not-a-spotify-url'), null);

console.log('Spotify playback smoke test passed.');
