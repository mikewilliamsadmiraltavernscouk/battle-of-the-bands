import type { BattleHistoryItem, MusicPick } from './types';

export function createRoomInviteShareMessage({
  inviteLink,
  roomCode,
}: {
  inviteLink: string;
  roomCode: string;
}) {
  return `Join my Battle of the Bands room with code ${roomCode}: ${inviteLink}`;
}

export function createWinnerShareMessage({
  battleHistory,
  champion,
  roomCode,
}: {
  battleHistory: BattleHistoryItem[];
  champion: MusicPick;
  roomCode: string;
}) {
  const recentResults = battleHistory
    .slice(-3)
    .map((item) => `Round ${item.round}: ${item.summary} (${item.winnerVotes}-${item.loserVotes})`);

  return [
    `${champion.artist} won our Battle of the Bands room ${roomCode}.`,
    `Winning album: ${champion.album}`,
    `${battleHistory.length} battles completed.`,
    recentResults.length > 0 ? `Recent results:\n${recentResults.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}
