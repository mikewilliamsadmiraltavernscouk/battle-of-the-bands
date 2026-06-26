import { searchSpotifyMock } from './mockSpotify';
import type { MusicPick, SpotifyAlbum, SpotifyArtist, SpotifyTrack } from './types';

const SEARCH_TIMEOUT_MS = 8000;

export type SpotifySearchService = {
  search: (query: string) => Promise<MusicPick[]>;
  searchArtists: (query: string) => Promise<SpotifyArtist[]>;
  getArtistAlbums: (artist: SpotifyArtist) => Promise<SpotifyAlbum[]>;
  getAlbumTracks: (albumId: string) => Promise<SpotifyTrack[]>;
};

export const mockSpotifySearchService: SpotifySearchService = {
  async search(query) {
    return searchSpotifyMock(query);
  },
  async searchArtists(query) {
    const results = searchSpotifyMock(query);
    return results.map((pick) => ({
      id: pick.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: pick.artist,
      spotifyUrl: pick.spotifyUrl.replace(':album:', ':artist:'),
      artworkUrl: pick.artworkUrl,
    }));
  },
  async getArtistAlbums() {
    return searchSpotifyMock('').map((pick) => ({
      ...pick,
      albumId: pick.spotifyUrl.split(':').at(-1) ?? pick.id,
    }));
  },
  async getAlbumTracks(albumId) {
    const album = searchSpotifyMock('').find((pick) => pick.spotifyUrl.includes(albumId)) ?? searchSpotifyMock('')[0];
    return [
      {
        ...album,
        id: `${album.id}:track:1`,
        album: `${album.album} - Track 1`,
        spotifyUrl: album.spotifyUrl,
        albumId,
        trackNumber: 1,
      },
    ];
  },
};

export function createBackendSpotifySearchService(endpoint: string): SpotifySearchService {
  return {
    async search(query) {
      const data = await getJson<{ results?: MusicPick[] }>(endpoint, { q: query });
      return data.results ?? [];
    },
    async searchArtists(query) {
      const data = await getJson<{ artists?: SpotifyArtist[] }>(endpointFor(endpoint, '/spotify/artists'), { q: query });
      return data.artists ?? [];
    },
    async getArtistAlbums(artist) {
      const data = await getJson<{ albums?: SpotifyAlbum[] }>(
        endpointFor(endpoint, `/spotify/artists/${artist.id}/albums`),
        { artist: artist.name },
      );
      return data.albums ?? [];
    },
    async getAlbumTracks(albumId) {
      const data = await getJson<{ tracks?: SpotifyTrack[] }>(endpointFor(endpoint, `/spotify/albums/${albumId}/tracks`));
      return data.tracks ?? [];
    },
  };
}

async function getJson<T>(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
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

  return (await response.json()) as T;
}

function endpointFor(searchEndpoint: string, pathname: string) {
  const url = new URL(searchEndpoint);
  url.pathname = pathname;
  url.search = '';
  return url.toString();
}
