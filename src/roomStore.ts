import { spotifyResults } from './mockSpotify';
import { pickRandomPair } from './randomMatch';
import type { BattleHistoryItem, BattleRoom, MusicPick, RoomMember } from './types';

export const MAX_ROOM_PICKS = 500;

export const demoMembers: RoomMember[] = [
  { id: 'mike', name: 'Mike', isHost: true },
  { id: 'sarah', name: 'Sarah', isHost: false },
  { id: 'ava', name: 'Ava', isHost: false },
  { id: 'leo', name: 'Leo', isHost: false },
];

export function createDemoRoom(code = 'BAND-482', members = demoMembers): BattleRoom {
  const seededPicks = members.length >= demoMembers.length ? [
    { ...spotifyResults[0], addedBy: 'Mike' },
    { ...spotifyResults[1], addedBy: 'Sarah' },
    { ...spotifyResults[2], addedBy: 'Ava' },
    { ...spotifyResults[3], addedBy: 'Leo' },
  ] : [];

  return {
    code,
    members,
    picks: seededPicks,
    battleQueue: [],
    currentMatch: null,
    champion: null,
    round: 0,
    matchVotes: {},
    battleHistory: [],
    voteHistory: [],
  };
}

export function createRoomCode() {
  return `BAND-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function getMajorityNeeded(room: BattleRoom) {
  return Math.floor(room.members.length / 2) + 1;
}

export function isBattleStarted(room: BattleRoom) {
  return room.currentMatch !== null || room.battleQueue.length > 0 || room.champion !== null;
}

export function canStartBattle(room: BattleRoom) {
  return room.picks.length >= 2 && !isBattleStarted(room);
}

export function getVoteCounts(room: BattleRoom) {
  if (!room.currentMatch) {
    return {};
  }

  return room.currentMatch.reduce<Record<string, number>>((counts, pick) => {
    counts[pick.id] = Object.values(room.matchVotes).filter((pickId) => pickId === pick.id).length;
    return counts;
  }, {});
}

export function isMatchTied(room: BattleRoom) {
  if (!room.currentMatch || Object.keys(room.matchVotes).length < room.members.length) {
    return false;
  }

  const voteCounts = getVoteCounts(room);
  return room.currentMatch.every((pick) => (voteCounts[pick.id] ?? 0) < getMajorityNeeded(room));
}

export function addPickToRoom(room: BattleRoom, pick: MusicPick, memberName: string): BattleRoom {
  if (
    room.picks.length >= MAX_ROOM_PICKS ||
    room.picks.some((item) => item.id === pick.id) ||
    isBattleStarted(room)
  ) {
    return room;
  }

  return {
    ...room,
    picks: [...room.picks, { ...pick, addedBy: memberName }],
  };
}

export function removePickFromRoom(room: BattleRoom, pickId: string): BattleRoom {
  if (isBattleStarted(room)) {
    return room;
  }

  return {
    ...room,
    picks: room.picks.filter((pick) => pick.id !== pickId),
  };
}

export function startRoomBattle(room: BattleRoom): BattleRoom {
  if (!canStartBattle(room)) {
    return room;
  }

  const match = pickRandomPair(room.picks);
  if (!match) {
    return room;
  }
  const [first, second] = match;
  const remaining = room.picks.filter((pick) => pick.id !== first.id && pick.id !== second.id);

  return {
    ...room,
    battleQueue: remaining,
    champion: null,
    currentMatch: [first, second],
    matchVotes: {},
    round: 1,
    battleHistory: [],
    voteHistory: [],
  };
}

export function castRoomVote(room: BattleRoom, memberId: string, pick: MusicPick): BattleRoom {
  if (
    !room.currentMatch ||
    room.matchVotes[memberId] ||
    !room.currentMatch.some((matchPick) => matchPick.id === pick.id)
  ) {
    return room;
  }

  const nextRoom = {
    ...room,
    matchVotes: { ...room.matchVotes, [memberId]: pick.id },
  };
  const votesForPick = Object.values(nextRoom.matchVotes).filter((pickId) => pickId === pick.id).length;

  if (votesForPick < getMajorityNeeded(room)) {
    return nextRoom;
  }

  return advanceWinner(nextRoom, pick);
}

export function resolveRoomTie(room: BattleRoom, pick: MusicPick): BattleRoom {
  if (!isMatchTied(room) || !room.currentMatch?.some((matchPick) => matchPick.id === pick.id)) {
    return room;
  }

  return advanceWinner(room, pick);
}

export function resetRoomBattle(room: BattleRoom): BattleRoom {
  return {
    ...room,
    battleQueue: [],
    champion: null,
    currentMatch: null,
    matchVotes: {},
    round: 0,
    battleHistory: [],
    voteHistory: [],
  };
}

function advanceWinner(room: BattleRoom, winner: MusicPick): BattleRoom {
  const loser = room.currentMatch?.find((pick) => pick.id !== winner.id);
  const historyItem = loser ? createHistoryItem(room.round, winner, loser, room.matchVotes) : null;
  const battleHistory = historyItem ? [...room.battleHistory, historyItem] : room.battleHistory;
  const voteHistory = historyItem ? battleHistory.map((item) => item.summary) : room.voteHistory;
  const availablePicks = [winner, ...room.battleQueue];
  const nextMatch = pickRandomPair(availablePicks);

  if (!nextMatch) {
    return {
      ...room,
      battleQueue: [],
      champion: winner,
      currentMatch: null,
      matchVotes: {},
      battleHistory,
      voteHistory,
    };
  }

  const [first, second] = nextMatch;

  return {
    ...room,
    battleQueue: availablePicks.filter((pick) => pick.id !== first.id && pick.id !== second.id),
    currentMatch: [first, second],
    matchVotes: {},
    round: room.round + 1,
    battleHistory,
    voteHistory,
  };
}

function createHistoryItem(
  round: number,
  winner: MusicPick,
  loser: MusicPick,
  matchVotes: Record<string, string>,
): BattleHistoryItem {
  const votes = Object.values(matchVotes);

  return {
    round,
    winner,
    loser,
    winnerVotes: votes.filter((pickId) => pickId === winner.id).length,
    loserVotes: votes.filter((pickId) => pickId === loser.id).length,
    summary: `${winner.artist} beat ${loser.artist} in round ${round}`,
  };
}
