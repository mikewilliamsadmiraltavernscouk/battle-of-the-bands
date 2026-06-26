export function toSpotifyWebUrl(spotifyUri: string) {
  if (spotifyUri.startsWith('https://open.spotify.com/')) {
    return spotifyUri;
  }

  const [scheme, type, id] = spotifyUri.split(':');
  if (scheme !== 'spotify' || !type || !id) {
    return null;
  }

  return `https://open.spotify.com/${type}/${id}`;
}
