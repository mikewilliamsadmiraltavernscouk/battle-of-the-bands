export type Screen = 'home' | 'room' | 'battle' | 'winner';

export type MusicPick = {
  id: string;
  artist: string;
  album: string;
  addedBy: string;
  spotifyUrl: string;
  artworkUrl?: string;
};

export type MatchVotes = Record<string, string>;

export type RoomMember = {
  id: string;
  name: string;
  isHost: boolean;
};

export type BattleHistoryItem = {
  round: number;
  winner: MusicPick;
  loser: MusicPick;
  winnerVotes: number;
  loserVotes: number;
  summary: string;
};

export type BattleRoom = {
  code: string;
  members: RoomMember[];
  picks: MusicPick[];
  battleQueue: MusicPick[];
  currentMatch: [MusicPick, MusicPick] | null;
  champion: MusicPick | null;
  round: number;
  matchVotes: MatchVotes;
  battleHistory: BattleHistoryItem[];
  voteHistory: string[];
};
