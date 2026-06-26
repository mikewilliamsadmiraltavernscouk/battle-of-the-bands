import {
  addPickToRoom,
  castRoomVote,
  createDemoRoom,
  MAX_ROOM_PICKS,
  removePickFromRoom,
  resolveRoomTie,
  resetRoomBattle,
  startRoomBattle,
} from './roomStore';
import type { BattleRoom, MusicPick } from './types';

export type RoomRepository = {
  createRoom: (code: string | undefined, hostName: string) => Promise<BattleRoom>;
  joinRoom: (code: string, memberName: string) => Promise<BattleRoom>;
  reloadRoom: (room: BattleRoom) => Promise<BattleRoom>;
  addPick: (room: BattleRoom, pick: MusicPick, memberName: string) => Promise<BattleRoom>;
  removePick: (room: BattleRoom, pickId: string) => Promise<BattleRoom>;
  startBattle: (room: BattleRoom, memberId: string) => Promise<BattleRoom>;
  castVote: (room: BattleRoom, memberId: string, pick: MusicPick) => Promise<BattleRoom>;
  resolveTie: (room: BattleRoom, memberId: string, pick: MusicPick) => Promise<BattleRoom>;
  resetBattle: (room: BattleRoom, memberId: string) => Promise<BattleRoom>;
};

const localRooms = new Map<string, BattleRoom>();

export const localRoomRepository: RoomRepository = {
  async createRoom(code, hostName) {
    const room = createDemoRoom(code, [{ id: toMemberId(hostName), name: hostName, isHost: true }]);
    localRooms.set(room.code, room);
    return room;
  },
  async joinRoom(code, memberName) {
    const existingRoom = localRooms.get(code);
    if (!existingRoom) {
      const room = createDemoRoom(code, [
        { id: 'host', name: 'Host', isHost: true },
        { id: toMemberId(memberName), name: memberName, isHost: false },
      ]);
      localRooms.set(code, room);
      return room;
    }

    const memberId = toUniqueMemberId(existingRoom, memberName);
    const alreadyJoined = existingRoom.members.some(
      (member) => member.name.trim().toLowerCase() === memberName.trim().toLowerCase(),
    );
    if (alreadyJoined) {
      return existingRoom;
    }

    const nextRoom = {
      ...existingRoom,
      members: [
        ...existingRoom.members,
        { id: memberId, name: memberName, isHost: false },
      ],
    };
    localRooms.set(code, nextRoom);
    return nextRoom;
  },
  async reloadRoom(room) {
    return localRooms.get(room.code) ?? room;
  },
  async addPick(room, pick, memberName) {
    const currentRoom = localRooms.get(room.code) ?? room;
    if (currentRoom.picks.length >= MAX_ROOM_PICKS) {
      throw new Error(`A room can hold up to ${MAX_ROOM_PICKS} bands.`);
    }
    const nextRoom = addPickToRoom(currentRoom, pick, memberName);
    localRooms.set(room.code, nextRoom);
    return nextRoom;
  },
  async removePick(room, pickId) {
    const nextRoom = removePickFromRoom(localRooms.get(room.code) ?? room, pickId);
    localRooms.set(room.code, nextRoom);
    return nextRoom;
  },
  async startBattle(room, memberId) {
    const currentRoom = localRooms.get(room.code) ?? room;
    assertHostMember(currentRoom, memberId, 'start the battle');
    const nextRoom = startRoomBattle(currentRoom);
    localRooms.set(room.code, nextRoom);
    return nextRoom;
  },
  async castVote(room, memberId, pick) {
    const nextRoom = castRoomVote(localRooms.get(room.code) ?? room, memberId, pick);
    localRooms.set(room.code, nextRoom);
    return nextRoom;
  },
  async resolveTie(room, memberId, pick) {
    const currentRoom = localRooms.get(room.code) ?? room;
    assertHostMember(currentRoom, memberId, 'resolve a tie');
    const nextRoom = resolveRoomTie(currentRoom, pick);
    localRooms.set(room.code, nextRoom);
    return nextRoom;
  },
  async resetBattle(room, memberId) {
    const currentRoom = localRooms.get(room.code) ?? room;
    assertHostMember(currentRoom, memberId, 'reset the battle');
    const nextRoom = resetRoomBattle(currentRoom);
    localRooms.set(room.code, nextRoom);
    return nextRoom;
  },
};

function assertHostMember(room: BattleRoom, memberId: string, action: string) {
  const member = room.members.find((item) => item.id === memberId);
  if (!member?.isHost) {
    throw new Error(`Only the host can ${action}.`);
  }
}

function toMemberId(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'friend';
}

function toUniqueMemberId(room: BattleRoom, name: string) {
  const baseId = toMemberId(name);
  const existingIds = new Set(room.members.map((member) => member.id));
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}
