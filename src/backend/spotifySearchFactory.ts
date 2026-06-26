import {
  createBackendSpotifySearchService,
  mockSpotifySearchService,
  type SpotifySearchService,
} from '../spotifySearchService';

export function createSpotifySearchService(): SpotifySearchService {
  const endpoint = process.env.EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT;

  if (!endpoint) {
    return mockSpotifySearchService;
  }

  return createBackendSpotifySearchService(endpoint);
}

export function getSpotifySearchMode() {
  return process.env.EXPO_PUBLIC_SPOTIFY_SEARCH_ENDPOINT ? 'backend' : 'mock';
}
