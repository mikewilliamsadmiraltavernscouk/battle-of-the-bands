const assert = require('node:assert/strict');
require('./register-ts');

async function main() {
  const { localRoomRepository } = require('../src/roomRepository.ts');
  const { createRoomCode, MAX_ROOM_PICKS } = require('../src/roomStore.ts');
  const { spotifyResults } = require('../src/mockSpotify.ts');

  assert.match(createRoomCode(), /^BAND-\d{6}$/);

  let hostRoom = await localRoomRepository.createRoom('BAND-TEST', 'Alex');
  assert.equal(hostRoom.code, 'BAND-TEST');
  assert.equal(hostRoom.members.length, 1);
  assert.equal(hostRoom.members[0].isHost, true);

  let friendRoom = await localRoomRepository.joinRoom('BAND-TEST', 'Jamie');
  assert.equal(friendRoom.members.length, 2);
  assert.equal(friendRoom.members.some((member) => member.name === 'Jamie'), true);

  hostRoom = await localRoomRepository.reloadRoom(hostRoom);
  assert.equal(hostRoom.members.length, 2);

  hostRoom = await localRoomRepository.addPick(hostRoom, spotifyResults[0], 'Alex');
  hostRoom = await localRoomRepository.addPick(hostRoom, spotifyResults[1], 'Jamie');
  assert.equal(hostRoom.picks.length, 2);

  const alex = hostRoom.members.find((member) => member.name === 'Alex');
  const jamie = hostRoom.members.find((member) => member.name === 'Jamie');
  assert.ok(alex);
  assert.ok(jamie);

  await assert.rejects(
    () => localRoomRepository.startBattle(hostRoom, jamie.id),
    /Only the host can start the battle/,
  );

  hostRoom = await localRoomRepository.startBattle(hostRoom, alex.id);
  assert.equal(hostRoom.round, 1);
  assert.notEqual(hostRoom.currentMatch, null);

  const [firstPick] = hostRoom.currentMatch;
  const outsidePick = spotifyResults.find((pick) => !hostRoom.currentMatch.some((matchPick) => matchPick.id === pick.id));
  assert.ok(outsidePick);
  const unchangedRoom = await localRoomRepository.castVote(hostRoom, alex.id, outsidePick);
  assert.equal(Object.keys(unchangedRoom.matchVotes).length, 0);

  hostRoom = await localRoomRepository.castVote(hostRoom, alex.id, firstPick);
  assert.equal(hostRoom.champion, null);

  hostRoom = await localRoomRepository.castVote(hostRoom, jamie.id, firstPick);
  assert.equal(hostRoom.champion?.id, firstPick.id);
  assert.equal(hostRoom.battleHistory.length, 1);
  assert.equal(hostRoom.battleHistory[0].round, 1);
  assert.equal(hostRoom.battleHistory[0].winner.id, firstPick.id);
  assert.equal(hostRoom.battleHistory[0].loser.id, hostRoom.picks.find((pick) => pick.id !== firstPick.id)?.id);
  assert.equal(hostRoom.battleHistory[0].winnerVotes, 2);
  assert.equal(hostRoom.battleHistory[0].loserVotes, 0);
  assert.equal(hostRoom.battleHistory[0].summary, hostRoom.voteHistory[0]);
  assert.equal(hostRoom.voteHistory.length, 1);

  await assert.rejects(
    () => localRoomRepository.resetBattle(hostRoom, jamie.id),
    /Only the host can reset the battle/,
  );

  hostRoom = await localRoomRepository.resetBattle(hostRoom, alex.id);
  assert.equal(hostRoom.currentMatch, null);
  assert.equal(hostRoom.champion, null);
  assert.equal(hostRoom.battleHistory.length, 0);
  assert.equal(hostRoom.voteHistory.length, 0);

  let tiedRoom = await localRoomRepository.createRoom('BAND-TIE', 'Alex');
  tiedRoom = await localRoomRepository.joinRoom('BAND-TIE', 'Jamie');
  tiedRoom = await localRoomRepository.addPick(tiedRoom, spotifyResults[0], 'Alex');
  tiedRoom = await localRoomRepository.addPick(tiedRoom, spotifyResults[1], 'Jamie');
  const tieHost = tiedRoom.members.find((member) => member.name === 'Alex');
  const tieFriend = tiedRoom.members.find((member) => member.name === 'Jamie');
  assert.ok(tieHost);
  assert.ok(tieFriend);
  tiedRoom = await localRoomRepository.startBattle(tiedRoom, tieHost.id);
  const [tieFirstPick, tieSecondPick] = tiedRoom.currentMatch;
  tiedRoom = await localRoomRepository.castVote(tiedRoom, tieHost.id, tieFirstPick);
  tiedRoom = await localRoomRepository.castVote(tiedRoom, tieFriend.id, tieSecondPick);
  assert.equal(tiedRoom.champion, null);
  assert.equal(Object.keys(tiedRoom.matchVotes).length, 2);
  await assert.rejects(
    () => localRoomRepository.resolveTie(tiedRoom, tieFriend.id, tieFirstPick),
    /Only the host can resolve a tie/,
  );
  tiedRoom = await localRoomRepository.resolveTie(tiedRoom, tieHost.id, tieFirstPick);
  assert.equal(tiedRoom.champion?.id, tieFirstPick.id);
  assert.equal(tiedRoom.battleHistory[0].winnerVotes, 1);
  assert.equal(tiedRoom.battleHistory[0].loserVotes, 1);

  let tournamentRoom = await localRoomRepository.createRoom('BAND-RANDOM', 'Alex');
  tournamentRoom = await localRoomRepository.joinRoom('BAND-RANDOM', 'Jamie');
  for (const pick of spotifyResults) {
    tournamentRoom = await localRoomRepository.addPick(tournamentRoom, pick, 'Alex');
  }

  const tournamentHost = tournamentRoom.members.find((member) => member.name === 'Alex');
  const tournamentFriend = tournamentRoom.members.find((member) => member.name === 'Jamie');
  assert.ok(tournamentHost);
  assert.ok(tournamentFriend);

  tournamentRoom = await localRoomRepository.startBattle(tournamentRoom, tournamentHost.id);
  while (tournamentRoom.currentMatch) {
    const [winner] = tournamentRoom.currentMatch;
    tournamentRoom = await localRoomRepository.castVote(tournamentRoom, tournamentHost.id, winner);
    tournamentRoom = await localRoomRepository.castVote(tournamentRoom, tournamentFriend.id, winner);
  }
  assert.ok(tournamentRoom.champion);
  assert.equal(tournamentRoom.battleHistory.length, spotifyResults.length - 1);
  assert.equal(tournamentRoom.voteHistory.length, spotifyResults.length - 1);
  assert.deepEqual(
    tournamentRoom.voteHistory,
    tournamentRoom.battleHistory.map((item) => item.summary),
  );
  assert.deepEqual(
    tournamentRoom.battleHistory.map((item) => item.round),
    Array.from({ length: spotifyResults.length - 1 }, (_, index) => index + 1),
  );
  assert.equal(tournamentRoom.battleHistory.every((item) => item.winnerVotes === 2), true);
  assert.equal(tournamentRoom.battleHistory.every((item) => item.loserVotes === 0), true);
  assert.equal(tournamentRoom.battleQueue.length, 0);

  let liveAddRoom = await localRoomRepository.createRoom('BAND-LIVE-ADD', 'Alex');
  liveAddRoom = await localRoomRepository.joinRoom('BAND-LIVE-ADD', 'Jamie');
  const liveAlex = liveAddRoom.members.find((member) => member.name === 'Alex');
  assert.ok(liveAlex);
  liveAddRoom = await localRoomRepository.addPick(liveAddRoom, spotifyResults[0], 'Alex');
  liveAddRoom = await localRoomRepository.addPick(liveAddRoom, spotifyResults[1], 'Jamie');
  liveAddRoom = await localRoomRepository.startBattle(liveAddRoom, liveAlex.id);
  assert.notEqual(liveAddRoom.currentMatch, null);
  liveAddRoom = await localRoomRepository.addPick(liveAddRoom, spotifyResults[2], 'Alex');
  assert.equal(liveAddRoom.picks.length, 3);
  assert.equal(liveAddRoom.battleQueue.some((pick) => pick.id === spotifyResults[2].id), true);

  let fullRoom = await localRoomRepository.createRoom('BAND-FULL', 'Alex');
  for (let index = 0; index < MAX_ROOM_PICKS; index += 1) {
    fullRoom = await localRoomRepository.addPick(
      fullRoom,
      {
        id: `generated-${index}`,
        artist: `Generated Band ${index}`,
        album: `Generated Album ${index}`,
        addedBy: 'Spotify',
        spotifyUrl: `spotify:album:generated-${index}`,
      },
      'Alex',
    );
  }
  assert.equal(fullRoom.picks.length, MAX_ROOM_PICKS);
  await assert.rejects(
    () => localRoomRepository.addPick(
      fullRoom,
      {
        id: 'generated-over-limit',
        artist: 'Generated Band Over Limit',
        album: 'Generated Album Over Limit',
        addedBy: 'Spotify',
        spotifyUrl: 'spotify:album:generated-over-limit',
      },
      'Alex',
    ),
    /A room can hold up to 500 bands/,
  );

  console.log('Local room smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
