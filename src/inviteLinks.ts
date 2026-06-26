const APP_SCHEME = 'battlebands';

export function createInviteLink(roomCode: string) {
  return `${APP_SCHEME}://join?code=${encodeURIComponent(roomCode)}`;
}

export function parseInviteCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes('://')) {
    return normalizeRoomCode(extractRoomCode(trimmed) ?? trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== `${APP_SCHEME}:` || url.hostname !== 'join') {
      return null;
    }

    return normalizeRoomCode(url.searchParams.get('code') ?? '');
  } catch {
    return normalizeRoomCode(extractRoomCode(trimmed) ?? '');
  }
}

function normalizeRoomCode(code: string) {
  const normalized = normalizeCodeText(code.trim());
  return normalized ? normalized : null;
}

function extractRoomCode(value: string) {
  const explicitCode = value.match(/\bBAND[-\s]?\d{3,6}\b/i)?.[0];
  if (explicitCode) {
    return explicitCode;
  }

  const standaloneDigits = value.match(/\b\d{3,6}\b/)?.[0];
  return standaloneDigits ? `BAND-${standaloneDigits}` : null;
}

function normalizeCodeText(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, '');
  const bandDigits = compact.match(/^BAND-?(\d{3,6})$/);
  if (bandDigits) {
    return `BAND-${bandDigits[1]}`;
  }

  const digitsOnly = compact.match(/^\d{3,6}$/);
  if (digitsOnly) {
    return `BAND-${compact}`;
  }

  return compact;
}
