const assert = require('node:assert/strict');
require('./register-ts');

const {
  createRoomInviteShareMessage,
  createWinnerShareMessage,
} = require('../src/shareMessages.ts');

const inviteMessage = createRoomInviteShareMessage({
  inviteLink: 'battlebands://join?code=BAND-999',
  roomCode: 'BAND-999',
});

assert.equal(
  inviteMessage,
  'Join my Battle of the Bands room with code BAND-999: battlebands://join?code=BAND-999',
);

const champion = createPick('winner', 'The Winners', 'Victory Road');
const history = [
  createHistory(1, 'Band 1', 'Band 2', 2, 1),
  createHistory(2, 'Band 3', 'Band 4', 3, 0),
  createHistory(3, 'Band 5', 'Band 6', 2, 0),
  createHistory(4, 'The Winners', 'Band 7', 2, 1),
];

const message = createWinnerShareMessage({
  battleHistory: history,
  champion,
  roomCode: 'BAND-999',
});

assert.match(message, /The Winners won our Battle of the Bands room BAND-999/);
assert.match(message, /Winning album: Victory Road/);
assert.match(message, /4 battles completed/);
assert.doesNotMatch(message, /Round 1:/);
assert.match(message, /Round 2: Band 3 beat Band 4 in round 2 \(3-0\)/);
assert.match(message, /Round 3: Band 5 beat Band 6 in round 3 \(2-0\)/);
assert.match(message, /Round 4: The Winners beat Band 7 in round 4 \(2-1\)/);

console.log('Share message smoke test passed.');

function createHistory(round, winnerName, loserName, winnerVotes, loserVotes) {
  const winner = createPick(`winner-${round}`, winnerName, `${winnerName} Album`);
  const loser = createPick(`loser-${round}`, loserName, `${loserName} Album`);

  return {
    round,
    winner,
    loser,
    winnerVotes,
    loserVotes,
    summary: `${winnerName} beat ${loserName} in round ${round}`,
  };
}

function createPick(id, artist, album) {
  return {
    id,
    artist,
    album,
    addedBy: 'Test',
    spotifyUrl: `spotify:album:${id}`,
  };
}
