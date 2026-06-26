import { createRoomCode, MAX_ROOM_PICKS } from '../roomStore';
import type { RoomRepository } from '../roomRepository';
import type { BattleHistoryItem, BattleRoom, MusicPick, RoomMember } from '../types';
import type { SupabaseConfig } from './supabaseConfig';

type SupabaseRow = Record<string, unknown>;
type RoomRow = {
  id: string;
  code: string;
  status: 'collecting' | 'battle' | 'complete';
  current_round: number;
};
type MemberRow = {
  id: string;
  display_name: string;
  is_host: boolean;
};
type PickRow = {
  id: string;
  added_by_member_id: string;
  spotify_id: string;
  spotify_uri: string;
  artist_name: string;
  album_name: string;
  artwork_url: string | null;
  seed_order: number;
  eliminated_at_round: number | null;
};
type MatchRow = {
  id: string;
  round: number;
  left_pick_id: string;
  right_pick_id: string;
  winner_pick_id: string | null;
};
type VoteRow = {
  match_id: string;
  member_id: string;
  pick_id: string;
};

export function createSupabaseRoomRepository(config: SupabaseConfig): RoomRepository {
  async function request<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Supabase request failed: ${response.status} ${message}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async function findRoomRow(code: string) {
    const rooms = await request<RoomRow[]>(
      `rooms?code=eq.${encodeURIComponent(code)}&select=*`,
    );

    if (!rooms[0]) {
      throw new Error(`Room ${code} was not found.`);
    }

    return rooms[0];
  }

  async function loadRoomByCode(code: string): Promise<BattleRoom> {
    const room = await findRoomRow(code);
    const [members, picks, matches] = await Promise.all([
      request<MemberRow[]>(
        `room_members?room_id=eq.${room.id}&select=*&order=joined_at.asc`,
      ),
      request<PickRow[]>(
        `room_picks?room_id=eq.${room.id}&select=*&order=seed_order.asc`,
      ),
      request<MatchRow[]>(
        `battle_matches?room_id=eq.${room.id}&select=*&order=round.desc`,
      ),
    ]);

    const roomMembers: RoomMember[] = members.map((member) => ({
      id: member.id,
      name: member.display_name,
      isHost: member.is_host,
    }));
    const musicPicks = picks.map((pick) => toMusicPick(pick, members));
    const activeMatch = matches.find((match) => !match.winner_pick_id) ?? null;
    const currentMatch = activeMatch ? toCurrentMatch(activeMatch, musicPicks) : null;
    const currentVotes = activeMatch
      ? await request<VoteRow[]>(
          `match_votes?match_id=eq.${activeMatch.id}&select=match_id,member_id,pick_id`,
        )
      : [];
    const completedMatchIds = matches
      .filter((match) => match.winner_pick_id)
      .map((match) => match.id);
    const completedVotes = completedMatchIds.length > 0
      ? await request<VoteRow[]>(
          `match_votes?match_id=in.(${completedMatchIds.join(',')})&select=match_id,member_id,pick_id`,
        )
      : [];
    const eliminatedPickIds = new Set(
      matches.flatMap((match) =>
        match.winner_pick_id
          ? [match.left_pick_id, match.right_pick_id].filter((pickId) => pickId !== match.winner_pick_id)
          : [],
      ),
    );
    const activePickIds = new Set(currentMatch?.map((pick) => pick.id) ?? []);
    const champion =
      room.status === 'complete'
        ? musicPicks.find((pick) => !eliminatedPickIds.has(pick.id)) ?? getChampion(matches, musicPicks)
        : null;
    const battleHistory = matches
      .filter((match) => match.winner_pick_id)
      .sort((left, right) => left.round - right.round)
      .map((match) => matchToHistory(match, musicPicks, completedVotes));

    return {
      code: room.code,
      members: roomMembers,
      picks: musicPicks,
      battleQueue:
        currentMatch || champion
          ? musicPicks.filter((pick) => !activePickIds.has(pick.id) && !eliminatedPickIds.has(pick.id))
          : [],
      currentMatch,
      champion,
      round: room.current_round,
      matchVotes: Object.fromEntries(
        currentVotes.map((vote) => [vote.member_id, pickIdToAppId(vote.pick_id, musicPicks)]),
      ),
      battleHistory,
      voteHistory: battleHistory.map((item) => item.summary),
    };
  }

  async function loadRoomRows(roomCode: string) {
    const room = await findRoomRow(roomCode);
    const [picks, matches] = await Promise.all([
      request<PickRow[]>(
        `room_picks?room_id=eq.${room.id}&select=*&order=seed_order.asc`,
      ),
      request<MatchRow[]>(
        `battle_matches?room_id=eq.${room.id}&select=*&order=round.desc`,
      ),
    ]);

    return { room, picks, matches };
  }

  return {
    async createRoom(code, hostName) {
      const roomCode = code ?? createRoomCode();
      const createdRooms = await request<RoomRow[]>('rooms', {
        method: 'POST',
        body: JSON.stringify({ code: roomCode }),
      });
      const createdRoom = createdRooms[0] ?? (await findRoomRow(roomCode));

      await request<SupabaseRow[]>('room_members', {
        method: 'POST',
        body: JSON.stringify({
          room_id: createdRoom.id,
          display_name: hostName,
          is_host: true,
        }),
      });

      return loadRoomByCode(roomCode);
    },
    async joinRoom(code, memberName) {
      const room = await findRoomRow(code);
      const existingMembers = await request<MemberRow[]>(
        `room_members?room_id=eq.${room.id}&display_name=eq.${encodeURIComponent(memberName)}&select=*`,
      );

      if (!existingMembers[0]) {
        await request<SupabaseRow[]>('room_members', {
          method: 'POST',
          body: JSON.stringify({
            room_id: room.id,
            display_name: memberName,
            is_host: false,
          }),
        });
      }

      return loadRoomByCode(code);
    },
    async reloadRoom(room) {
      return loadRoomByCode(room.code);
    },
    async addPick(room, pick, memberName) {
      const roomRow = await findRoomRow(room.code);
      const members = await request<MemberRow[]>(
        `room_members?room_id=eq.${roomRow.id}&display_name=eq.${encodeURIComponent(memberName)}&select=*`,
      );
      const member = members[0];
      if (!member) {
        throw new Error(`${memberName} is not a member of room ${room.code}.`);
      }
      if (room.picks.length >= MAX_ROOM_PICKS) {
        throw new Error(`A room can hold up to ${MAX_ROOM_PICKS} bands.`);
      }

      await request<SupabaseRow[]>('room_picks', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomRow.id,
          added_by_member_id: member.id,
          spotify_id: getSpotifyId(pick),
          spotify_uri: pick.spotifyUrl,
          artist_name: pick.artist,
          album_name: pick.album,
          artwork_url: pick.artworkUrl ?? null,
          seed_order: room.picks.length,
        }),
      });

      return loadRoomByCode(room.code);
    },
    async removePick(room, pickId) {
      const roomRow = await findRoomRow(room.code);
      const pick = room.picks.find((item) => item.id === pickId);
      if (!pick) {
        return room;
      }

      await request<undefined>(
        `room_picks?room_id=eq.${roomRow.id}&spotify_uri=eq.${encodeURIComponent(pick.spotifyUrl)}`,
        { method: 'DELETE' },
      );

      return loadRoomByCode(room.code);
    },
    async startBattle(room, memberId) {
      await request<SupabaseRow[]>('rpc/start_room_battle', {
        method: 'POST',
        body: JSON.stringify({
          p_room_code: room.code,
          p_member_id: memberId,
        }),
      });

      return loadRoomByCode(room.code);
    },
    async castVote(room, memberId, pick) {
      const { matches } = await loadRoomRows(room.code);
      const activeMatch = matches.find((match) => !match.winner_pick_id);
      if (!activeMatch) {
        return loadRoomByCode(room.code);
      }

      await request<SupabaseRow[]>('rpc/cast_match_vote', {
        method: 'POST',
        body: JSON.stringify({
          p_match_id: activeMatch.id,
          p_member_id: memberId,
          p_pick_id: pick.id,
        }),
      });

      return loadRoomByCode(room.code);
    },
    async resolveTie(room, memberId, pick) {
      const { matches } = await loadRoomRows(room.code);
      const activeMatch = matches.find((match) => !match.winner_pick_id);
      if (!activeMatch) {
        return loadRoomByCode(room.code);
      }

      await request<SupabaseRow[]>('rpc/resolve_match_tie', {
        method: 'POST',
        body: JSON.stringify({
          p_match_id: activeMatch.id,
          p_member_id: memberId,
          p_pick_id: pick.id,
        }),
      });

      return loadRoomByCode(room.code);
    },
    async resetBattle(room, memberId) {
      await request<SupabaseRow[]>('rpc/reset_room_battle', {
        method: 'POST',
        body: JSON.stringify({
          p_room_code: room.code,
          p_member_id: memberId,
        }),
      });

      return loadRoomByCode(room.code);
    },
  };
}

function toMusicPick(pick: PickRow, members: MemberRow[]): MusicPick {
  return {
    id: pick.id,
    artist: pick.artist_name,
    album: pick.album_name,
    addedBy:
      members.find((member) => member.id === pick.added_by_member_id)?.display_name ?? 'Friend',
    spotifyUrl: pick.spotify_uri,
    artworkUrl: pick.artwork_url ?? undefined,
  };
}

function toCurrentMatch(match: MatchRow, picks: MusicPick[]): [MusicPick, MusicPick] | null {
  const left = pickIdToMusicPick(match.left_pick_id, picks);
  const right = pickIdToMusicPick(match.right_pick_id, picks);

  return left && right ? [left, right] : null;
}

function getChampion(matches: MatchRow[], picks: MusicPick[]) {
  const finalMatch = matches.find((match) => match.winner_pick_id);
  return finalMatch?.winner_pick_id ? pickIdToMusicPick(finalMatch.winner_pick_id, picks) : null;
}

function matchToHistory(match: MatchRow, picks: MusicPick[], votes: VoteRow[]): BattleHistoryItem {
  const winner = match.winner_pick_id ? pickIdToMusicPick(match.winner_pick_id, picks) : null;
  const loserId = [match.left_pick_id, match.right_pick_id].find(
    (pickId) => pickId !== match.winner_pick_id,
  );
  const loser = loserId ? pickIdToMusicPick(loserId, picks) : null;

  if (!winner || !loser) {
    const fallbackPick = picks[0] ?? {
      id: 'unknown',
      artist: 'Unknown',
      album: 'Unknown',
      addedBy: 'Unknown',
      spotifyUrl: 'spotify:unknown',
    };

    return {
      round: match.round,
      winner: winner ?? fallbackPick,
      loser: loser ?? fallbackPick,
      winnerVotes: 0,
      loserVotes: 0,
      summary: `Round ${match.round} completed`,
    };
  }

  const matchVotes = votes.filter((vote) => vote.match_id === match.id);

  return {
    round: match.round,
    winner,
    loser,
    winnerVotes: matchVotes.filter((vote) => pickIdToAppId(vote.pick_id, picks) === winner.id).length,
    loserVotes: matchVotes.filter((vote) => pickIdToAppId(vote.pick_id, picks) === loser.id).length,
    summary: `${winner.artist} beat ${loser.artist} in round ${match.round}`,
  };
}

function pickIdToMusicPick(databasePickId: string, picks: MusicPick[]) {
  return picks.find((pick) => pick.id === databasePickId || pick.spotifyUrl === databasePickId) ?? null;
}

function pickIdToAppId(databasePickId: string, picks: MusicPick[]) {
  return pickIdToMusicPick(databasePickId, picks)?.id ?? databasePickId;
}

function getSpotifyId(pick: MusicPick) {
  return pick.spotifyUrl.split(':').at(-1) ?? pick.id;
}
