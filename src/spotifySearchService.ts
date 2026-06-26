import { searchSpotifyMock } from './mockSpotify';
import type { MusicPick } from './types';

const SEARCH_TIMEOUT_MS = 8000;

export type SpotifySearchService = {
  search: (query: string) => Promise<MusicPick[]>;
};

export const mockSpotifySearchService: SpotifySearchService = {
  async search(query) {
    return searchSpotifyMock(query);
  },
};

export function createBackendSpotifySearchService(endpoint: string): SpotifySearchService {
  return {
    async search(query) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Spotify search timed out. Check that the Spotify backend is running and reachable from this phone.');
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Spotify search failed: ${response.status} ${message}`);
      }

      const data = (await response.json()) as { results?: MusicPick[] };
      return data.results ?? [];
    },
  };
}
