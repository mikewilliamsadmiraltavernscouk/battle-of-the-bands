import { Linking } from 'react-native';
import type { MusicPick } from './types';
import { toSpotifyWebUrl } from './spotifyUrls';

export async function openSpotifyPick(pick: MusicPick) {
  const spotifyUri = pick.spotifyUrl;
  const webUrl = toSpotifyWebUrl(spotifyUri);

  try {
    await Linking.openURL(spotifyUri);
    return { opened: 'app' as const };
  } catch {
    if (webUrl) {
      await Linking.openURL(webUrl);
      return { opened: 'web' as const };
    }

    throw new Error('Spotify could not be opened for this item.');
  }
}

export { toSpotifyWebUrl };
