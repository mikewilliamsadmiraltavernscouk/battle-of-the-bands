const assert = require('node:assert/strict');
require('./register-ts');

const storage = new Map();

global.__expoSecureStoreMock = {
  async getItemAsync(key) {
    return storage.get(key) ?? null;
  },
  async setItemAsync(key, value) {
    storage.set(key, value);
  },
  async deleteItemAsync(key) {
    storage.delete(key);
  },
};

async function main() {
  const {
    forgetSavedRoomSession,
    loadLastRoomSession,
    loadSavedRoomSessions,
    saveLastRoomSession,
  } = require('../src/roomSessionStore.ts');

  await saveLastRoomSession({
    roomCode: 'BAND-111111',
    memberName: 'Alex',
    screen: 'room',
    roomLabel: 'Friday final',
  });
  await saveLastRoomSession({
    roomCode: 'BAND-222222',
    memberName: 'Jamie',
    screen: 'winner',
  });

  const lastRoom = await loadLastRoomSession();
  assert.equal(lastRoom.roomCode, 'BAND-222222');
  assert.equal(lastRoom.screen, 'winner');
  assert.equal(lastRoom.roomLabel, undefined);

  let savedRooms = await loadSavedRoomSessions();
  assert.equal(savedRooms.length, 2);
  assert.equal(savedRooms[0].roomCode, 'BAND-222222');
  assert.equal(savedRooms[1].roomCode, 'BAND-111111');
  assert.equal(savedRooms[1].roomLabel, 'Friday final');

  await saveLastRoomSession({
    roomCode: 'BAND-111111',
    memberName: 'Alex',
    screen: 'battle',
    roomLabel: 'Updated label',
  });
  savedRooms = await loadSavedRoomSessions();
  assert.equal(savedRooms.length, 2);
  assert.equal(savedRooms[0].roomCode, 'BAND-111111');
  assert.equal(savedRooms[0].screen, 'battle');
  assert.equal(savedRooms[0].roomLabel, 'Updated label');

  await forgetSavedRoomSession('BAND-111111');
  savedRooms = await loadSavedRoomSessions();
  assert.equal(savedRooms.length, 1);
  assert.equal(savedRooms[0].roomCode, 'BAND-222222');
  assert.equal(await loadLastRoomSession(), null);

  console.log('Room session smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
