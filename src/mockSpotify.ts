import type { MusicPick } from './types';

export const spotifyResults: MusicPick[] = [
  {
    id: 'radiohead-ok-computer',
    artist: 'Radiohead',
    album: 'OK Computer',
    addedBy: 'Spotify',
    spotifyUrl: 'spotify:album:6dVIqQ8qmQ5GBnJ9shOYGE',
  },
  {
    id: 'fleetwood-mac-rumours',
    artist: 'Fleetwood Mac',
    album: 'Rumours',
    addedBy: 'Spotify',
    spotifyUrl: 'spotify:album:1bt6q2SruMsBtcerNVtpZB',
  },
  {
    id: 'kendrick-lamar-good-kid',
    artist: 'Kendrick Lamar',
    album: 'good kid, m.A.A.d city',
    addedBy: 'Spotify',
    spotifyUrl: 'spotify:album:748dZDqSZy6aPXKcI9H80u',
  },
  {
    id: 'arctic-monkeys-am',
    artist: 'Arctic Monkeys',
    album: 'AM',
    addedBy: 'Spotify',
    spotifyUrl: 'spotify:album:78bpIziExqiI9qztvNFlQu',
  },
  {
    id: 'beyonce-lemonade',
    artist: 'Beyonce',
    album: 'Lemonade',
    addedBy: 'Spotify',
    spotifyUrl: 'spotify:album:7dK54iZuOxXFarGhXwEXfF',
  },
  {
    id: 'the-strokes-is-this-it',
    artist: 'The Strokes',
    album: 'Is This It',
    addedBy: 'Spotify',
    spotifyUrl: 'spotify:album:2k8KgmDp9oHrmu0MIj4XDE',
  },
];

export function searchSpotifyMock(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return spotifyResults;
  }

  return spotifyResults.filter((pick) =>
    `${pick.artist} ${pick.album}`.toLowerCase().includes(normalizedQuery),
  );
}
