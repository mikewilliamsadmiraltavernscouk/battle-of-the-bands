import * as SecureStore from 'expo-secure-store';
import type { Screen } from './types';

const LAST_ROOM_KEY = 'battleBands.lastRoom.v1';
const SAVED_ROOMS_KEY = 'battleBands.savedRooms.v1';
const MAX_SAVED_ROOMS = 20;

export type LastRoomSession = {
  roomCode: string;
  memberName: string;
  screen: Exclude<Screen, 'home'>;
  roomLabel?: string;
};

export type SavedRoomSession = LastRoomSession & {
  lastOpenedAt: string;
};

export async function saveLastRoomSession(session: LastRoomSession) {
  await SecureStore.setItemAsync(LAST_ROOM_KEY, JSON.stringify(session));
  await saveRoomToList(session);
}

export async function loadLastRoomSession() {
  const rawSession = await SecureStore.getItemAsync(LAST_ROOM_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession) as Partial<LastRoomSession>;
    if (!session.roomCode || !session.memberName) {
      return null;
    }

    return {
      roomCode: session.roomCode,
      memberName: session.memberName,
      screen: session.screen === 'battle' || session.screen === 'winner' ? session.screen : 'room',
      roomLabel: cleanRoomLabel(session.roomLabel),
    } satisfies LastRoomSession;
  } catch {
    await clearLastRoomSession();
    return null;
  }
}

export async function clearLastRoomSession() {
  await SecureStore.deleteItemAsync(LAST_ROOM_KEY);
}

export async function loadSavedRoomSessions() {
  const rawRooms = await SecureStore.getItemAsync(SAVED_ROOMS_KEY);
  if (!rawRooms) {
    return [];
  }

  try {
    const rooms = JSON.parse(rawRooms) as Partial<SavedRoomSession>[];
    return rooms
      .map(normalizeSavedRoom)
      .filter((room): room is SavedRoomSession => room !== null)
      .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
  } catch {
    await SecureStore.deleteItemAsync(SAVED_ROOMS_KEY);
    return [];
  }
}

export async function forgetSavedRoomSession(roomCode: string) {
  const rooms = await loadSavedRoomSessions();
  await SecureStore.setItemAsync(
    SAVED_ROOMS_KEY,
    JSON.stringify(rooms.filter((room) => room.roomCode !== roomCode)),
  );

  const lastRoom = await loadLastRoomSession();
  if (lastRoom?.roomCode === roomCode) {
    await clearLastRoomSession();
  }
}

async function saveRoomToList(session: LastRoomSession) {
  const rooms = await loadSavedRoomSessions();
  const nextRoom = {
    ...session,
    lastOpenedAt: new Date().toISOString(),
  };
  const nextRooms = [
    nextRoom,
    ...rooms.filter((room) => room.roomCode !== session.roomCode),
  ].slice(0, MAX_SAVED_ROOMS);

  await SecureStore.setItemAsync(SAVED_ROOMS_KEY, JSON.stringify(nextRooms));
}

function normalizeSavedRoom(room: Partial<SavedRoomSession>): SavedRoomSession | null {
  if (!room.roomCode || !room.memberName) {
    return null;
  }

  const roomLabel = cleanRoomLabel(room.roomLabel);

  return {
    roomCode: room.roomCode,
    memberName: room.memberName,
    screen: room.screen === 'battle' || room.screen === 'winner' ? room.screen : 'room',
    lastOpenedAt: room.lastOpenedAt ?? new Date(0).toISOString(),
    ...(roomLabel ? { roomLabel } : {}),
  } satisfies SavedRoomSession;
}

function cleanRoomLabel(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
