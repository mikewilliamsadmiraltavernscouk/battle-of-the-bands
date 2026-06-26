import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createRoomRepository,
  getRoomRepositoryMode,
} from './src/backend/roomRepositoryFactory';
import {
  createSpotifySearchService,
  getSpotifySearchMode,
} from './src/backend/spotifySearchFactory';
import {
  canStartBattle,
  createDemoRoom,
  createRoomCode,
  getMajorityNeeded,
  getVoteCounts,
  isBattleStarted,
  isMatchTied,
  MAX_ROOM_PICKS,
} from './src/roomStore';
import type {
  BattleHistoryItem,
  BattleRoom,
  MatchVotes,
  MusicPick,
  RoomMember,
  Screen,
} from './src/types';
import { openSpotifyPick } from './src/spotifyPlayback';
import { createInviteLink, parseInviteCode } from './src/inviteLinks';
import { createRoomInviteShareMessage, createWinnerShareMessage } from './src/shareMessages';

const roomRepository = createRoomRepository();
const roomRepositoryMode = getRoomRepositoryMode();
const spotifySearchService = createSpotifySearchService();
const spotifySearchMode = getSpotifySearchMode();
const SHARED_LIST_PREVIEW_LIMIT = 25;
const BATTLE_HISTORY_PREVIEW_LIMIT = 5;
const WINNER_HISTORY_PREVIEW_LIMIT = 25;

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [room, setRoom] = useState<BattleRoom>(() => createDemoRoom());
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(room.members[0].id);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MusicPick[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<MusicPick | null>(null);

  const selectedMember = room.members.find((member) => member.id === selectedMemberId) ?? room.members[0];
  const isCurrentUserHost = Boolean(selectedMember?.isHost);
  const battleStarted = isBattleStarted(room);
  const roomCanStartBattle = canStartBattle(room);
  const roomIsFull = room.picks.length >= MAX_ROOM_PICKS;
  const majorityNeeded = getMajorityNeeded(room);
  const voteCounts = getVoteCounts(room);
  const matchIsTied = isMatchTied(room);

  useEffect(() => {
    let cancelled = false;

    async function search() {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await spotifySearchService.search(query);
        if (!cancelled) {
          setSearchResults(results);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchResults([]);
          setSearchError(error instanceof Error ? error.message : 'Spotify search failed.');
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }

    search();

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (screen === 'home' || roomRepositoryMode !== 'supabase') {
      return undefined;
    }

    const interval = setInterval(() => {
      refreshRoom(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [room.code, screen]);

  useEffect(() => {
    function applyInviteUrl(url: string | null) {
      if (!url) {
        return;
      }

      const inviteCode = parseInviteCode(url);
      if (inviteCode) {
        setJoinCode(inviteCode);
        setScreen('home');
      }
    }

    Linking.getInitialURL().then(applyInviteUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', (event) => {
      applyInviteUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  async function runRoomAction(action: () => Promise<void>, failureTitle = 'Room sync failed') {
    try {
      await action();
    } catch (error) {
      Alert.alert(
        failureTitle,
        error instanceof Error ? error.message : 'The room could not be updated.',
      );
    }
  }

  async function refreshRoom(showErrors = true) {
    try {
      const nextRoom = await roomRepository.reloadRoom(room);
      setRoom(nextRoom);
      if (nextRoom.champion) {
        setScreen('winner');
      }
    } catch (error) {
      if (showErrors) {
        Alert.alert(
          'Refresh failed',
          error instanceof Error ? error.message : 'The room could not be refreshed.',
        );
      }
    }
  }

  async function createRoom() {
    const memberName = displayName.trim();
    if (!memberName) {
      Alert.alert('Name needed', 'Enter your name before creating a room.');
      return;
    }

    await runRoomAction(async () => {
      const nextRoom = await roomRepository.createRoom(createRoomCode(), memberName);
      setRoom(nextRoom);
      setSelectedMemberId(nextRoom.members[0].id);
      setScreen('room');
    }, 'Create room failed');
  }

  async function joinRoom() {
    const normalizedCode = parseInviteCode(joinCode);
    if (!normalizedCode) {
      Alert.alert('Room code needed', 'Enter a room code or invite link from a friend.');
      return;
    }
    const memberName = displayName.trim();
    if (!memberName) {
      Alert.alert('Name needed', 'Enter your name before joining a room.');
      return;
    }

    await runRoomAction(async () => {
      const nextRoom = await roomRepository.joinRoom(normalizedCode, memberName);
      setRoom(nextRoom);
      const joinedMember = nextRoom.members.find((member) => member.name === memberName);
      setSelectedMemberId(joinedMember?.id ?? nextRoom.members[0].id);
      setScreen('room');
    }, 'Join room failed');
  }

  async function addPick(pick: MusicPick) {
    await runRoomAction(async () => {
      setRoom(await roomRepository.addPick(room, pick, selectedMember.name));
    }, 'Add band failed');
  }

  async function removePick(id: string) {
    await runRoomAction(async () => {
      setRoom(await roomRepository.removePick(room, id));
    }, 'Remove band failed');
  }

  async function startBattle() {
    await runRoomAction(async () => {
      setRoom(await roomRepository.startBattle(room, selectedMemberId));
      setScreen('battle');
    }, 'Start battle failed');
  }

  async function castVote(memberId: string, pick: MusicPick) {
    await runRoomAction(async () => {
      const nextRoom = await roomRepository.castVote(room, memberId, pick);
      setRoom(nextRoom);
      if (nextRoom.champion) {
        setScreen('winner');
      }
    }, 'Vote failed');
  }

  async function resolveTie(pick: MusicPick) {
    await runRoomAction(async () => {
      const nextRoom = await roomRepository.resolveTie(room, selectedMemberId, pick);
      setRoom(nextRoom);
      if (nextRoom.champion) {
        setScreen('winner');
      }
    }, 'Tiebreaker failed');
  }

  async function resetBattle() {
    await runRoomAction(async () => {
      setRoom(await roomRepository.resetBattle(room, selectedMemberId));
      setScreen('room');
    }, 'Reset battle failed');
  }

  function leaveRoom() {
    setNowPlaying(null);
    setQuery('');
    setSearchError(null);
    setSearchResults([]);
    setScreen('home');
  }

  async function shareRoom() {
    await runRoomAction(async () => {
      await Share.share({
        title: 'Join my Battle of the Bands room',
        message: createRoomInviteShareMessage({
          inviteLink: createInviteLink(room.code),
          roomCode: room.code,
        }),
      });
    }, 'Share room failed');
  }

  async function shareWinner() {
    const champion = room.champion;
    if (!champion) {
      return;
    }

    await runRoomAction(async () => {
      await Share.share({
        title: 'Battle of the Bands winner',
        message: createWinnerShareMessage({
          battleHistory: room.battleHistory,
          champion,
          roomCode: room.code,
        }),
      });
    }, 'Share result failed');
  }

  async function playOnSpotify(pick: MusicPick) {
    setNowPlaying(pick);
    openSpotifyPick(pick).catch((error) => {
      Alert.alert(
        'Spotify playback',
        error instanceof Error ? error.message : 'Spotify could not be opened for this item.',
      );
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        {screen === 'home' ? (
          <HomeScreen
            displayName={displayName}
            joinCode={joinCode}
            roomMode={roomRepositoryMode}
            searchMode={spotifySearchMode}
            setDisplayName={setDisplayName}
            setJoinCode={setJoinCode}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
          />
        ) : null}

        {screen !== 'home' ? (
          <RoomHeader
            roomCode={room.code}
            screen={screen}
            members={room.members}
            mode={roomRepositoryMode}
            picksCount={room.picks.length}
            nowPlaying={nowPlaying}
            onRoom={() => setScreen('room')}
            onBattle={() => setScreen(room.currentMatch ? 'battle' : room.champion ? 'winner' : 'battle')}
            onLeave={leaveRoom}
            onRefresh={() => refreshRoom()}
            onShare={shareRoom}
          />
        ) : null}

        {screen === 'room' ? (
          <RoomScreen
            battleStarted={battleStarted}
            canStartBattle={roomCanStartBattle}
            members={room.members}
            query={query}
            searchError={searchError}
            searchResults={searchResults}
            searchMode={spotifySearchMode}
            searching={searching}
            selectedMemberId={selectedMemberId}
            sharedList={room.picks}
            isCurrentUserHost={isCurrentUserHost}
            roomIsFull={roomIsFull}
            onAddPick={addPick}
            onMemberChange={setSelectedMemberId}
            onQueryChange={setQuery}
            onRemovePick={removePick}
            onStartBattle={startBattle}
          />
        ) : null}

        {screen === 'battle' ? (
          <BattleScreen
            battleQueue={room.battleQueue}
            champion={room.champion}
            currentMatch={room.currentMatch}
            currentMemberId={selectedMemberId}
            majorityNeeded={majorityNeeded}
            matchVotes={room.matchVotes}
            members={room.members}
            round={room.round}
            battleHistory={room.battleHistory}
            voteHistory={room.voteHistory}
            voteCounts={voteCounts}
            matchIsTied={matchIsTied}
            canStartBattle={roomCanStartBattle}
            isCurrentUserHost={isCurrentUserHost}
            onPlay={playOnSpotify}
            onResolveTie={resolveTie}
            onStartBattle={startBattle}
            onVote={castVote}
          />
        ) : null}

        {screen === 'winner' && room.champion ? (
          <WinnerScreen
            champion={room.champion}
            battleHistory={room.battleHistory}
            isCurrentUserHost={isCurrentUserHost}
            voteHistory={room.voteHistory}
            onPlay={() => {
              if (room.champion) {
                playOnSpotify(room.champion);
              }
            }}
            onReset={resetBattle}
            onShare={shareWinner}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeScreen({
  displayName,
  joinCode,
  roomMode,
  searchMode,
  setDisplayName,
  setJoinCode,
  onCreateRoom,
  onJoinRoom,
}: {
  displayName: string;
  joinCode: string;
  roomMode: string;
  searchMode: string;
  setDisplayName: (value: string) => void;
  setJoinCode: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}) {
  const nextSetupStep =
    roomMode !== 'supabase'
      ? 'Next: connect Supabase so different phones can join the same room.'
      : searchMode !== 'backend'
        ? 'Next: connect the Spotify search backend for real artists and albums.'
        : 'Ready for live room testing with friends.';

  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Spotify Battle Room</Text>
        <Text style={styles.title}>Battle of the Bands</Text>
        <Text style={styles.subtitle}>
          Create a room, let friends add Spotify albums, play each matchup, then vote
          until one winner is left.
        </Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Setup status</Text>
            <Text style={styles.panelMeta}>
              {roomMode === 'supabase'
                ? 'Rooms are shared between devices.'
                : 'Local demo mode: rooms stay on this device.'}
            </Text>
          </View>
          <Text style={roomMode === 'supabase' ? styles.readyBadge : styles.setupBadge}>
            {roomMode === 'supabase' ? 'Shared' : 'Local'}
          </Text>
        </View>

        <View style={styles.setupRows}>
          <View style={styles.setupRow}>
            <Text style={styles.setupLabel}>Room storage</Text>
            <Text style={styles.setupValue}>
              {roomMode === 'supabase' ? 'Supabase connected' : 'Needs Supabase for friends'}
            </Text>
          </View>
          <View style={styles.setupRow}>
            <Text style={styles.setupLabel}>Spotify search</Text>
            <Text style={styles.setupValue}>
              {searchMode === 'backend' ? 'Real Spotify backend' : 'Mock search results'}
            </Text>
          </View>
        </View>
        <Text style={styles.setupHint}>{nextSetupStep}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Your name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          placeholder="Enter display name"
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Start a room</Text>
        <Pressable onPress={onCreateRoom} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Create battle room</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Join friends</Text>
        <TextInput
          value={joinCode}
          onChangeText={setJoinCode}
          autoCapitalize="characters"
          placeholder="Enter room code or invite link"
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />
        <Pressable onPress={onJoinRoom} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Join room</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RoomHeader({
  roomCode,
  screen,
  members,
  mode,
  picksCount,
  nowPlaying,
  onRoom,
  onBattle,
  onLeave,
  onRefresh,
  onShare,
}: {
  roomCode: string;
  screen: Screen;
  members: RoomMember[];
  mode: string;
  picksCount: number;
  nowPlaying: MusicPick | null;
  onRoom: () => void;
  onBattle: () => void;
  onLeave: () => void;
  onRefresh: () => void;
  onShare: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.eyebrow}>Room {roomCode}</Text>
          <Text style={styles.headerTitle}>Shared battle list</Text>
          <Text style={styles.panelMeta}>
            {picksCount} Spotify picks - {mode} room
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onShare}>
            <Text style={styles.shareText}>Share</Text>
          </Pressable>
          <Pressable onPress={onRefresh}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
          <Pressable onPress={onLeave}>
            <Text style={styles.removeText}>Leave</Text>
          </Pressable>
        </View>
      </View>

      {nowPlaying ? (
        <View style={styles.nowPlaying}>
          <Text style={styles.nowPlayingLabel}>Now playing through Spotify</Text>
          <Text style={styles.nowPlayingText}>
            {nowPlaying.artist} - {nowPlaying.album}
          </Text>
        </View>
      ) : null}

      <View style={styles.memberRow}>
        {members.map((member) => (
          <View key={member.id} style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>
              {member.name}
              {member.isHost ? ' host' : ''}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.tabRow}>
        <Pressable
          onPress={onRoom}
          style={[styles.tab, screen === 'room' && styles.tabActive]}
        >
          <Text style={[styles.tabText, screen === 'room' && styles.tabTextActive]}>
            Add music
          </Text>
        </Pressable>
        <Pressable
          onPress={onBattle}
          style={[styles.tab, screen !== 'room' && styles.tabActive]}
        >
          <Text style={[styles.tabText, screen !== 'room' && styles.tabTextActive]}>
            Battle
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RoomScreen({
  battleStarted,
  canStartBattle,
  members,
  query,
  searchError,
  searchResults,
  searchMode,
  searching,
  selectedMemberId,
  sharedList,
  isCurrentUserHost,
  roomIsFull,
  onAddPick,
  onMemberChange,
  onQueryChange,
  onRemovePick,
  onStartBattle,
}: {
  battleStarted: boolean;
  canStartBattle: boolean;
  members: RoomMember[];
  query: string;
  searchError: string | null;
  searchResults: MusicPick[];
  searchMode: string;
  searching: boolean;
  selectedMemberId: string;
  sharedList: MusicPick[];
  isCurrentUserHost: boolean;
  roomIsFull: boolean;
  onAddPick: (pick: MusicPick) => void;
  onMemberChange: (memberId: string) => void;
  onQueryChange: (query: string) => void;
  onRemovePick: (id: string) => void;
  onStartBattle: () => void;
}) {
  const [sharedListQuery, setSharedListQuery] = useState('');
  const normalizedSharedListQuery = sharedListQuery.trim().toLowerCase();
  const filteredSharedList = normalizedSharedListQuery
    ? sharedList.filter((pick) =>
        `${pick.artist} ${pick.album} ${pick.addedBy}`.toLowerCase().includes(normalizedSharedListQuery),
      )
    : sharedList;
  const visibleSharedList = filteredSharedList.slice(0, SHARED_LIST_PREVIEW_LIMIT);
  const hiddenSharedListCount = Math.max(filteredSharedList.length - visibleSharedList.length, 0);
  const spotsLeft = Math.max(MAX_ROOM_PICKS - sharedList.length, 0);
  const capacityPercent = Math.min((sharedList.length / MAX_ROOM_PICKS) * 100, 100);
  const startBattleHint = getStartBattleHint(sharedList.length, battleStarted, canStartBattle);

  return (
    <View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Who is adding music?</Text>
        <View style={styles.friendRow}>
          {members.map((member) => (
            <Pressable
              key={member.id}
              onPress={() => onMemberChange(member.id)}
              style={[
                styles.friendPill,
                selectedMemberId === member.id && styles.friendPillActive,
              ]}
            >
              <Text
                style={[
                  styles.friendPillText,
                  selectedMemberId === member.id && styles.friendPillTextActive,
                ]}
              >
                {member.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <RoomStatusPanel
        members={members}
        selectedMemberId={selectedMemberId}
        sharedList={sharedList}
        canStartBattle={canStartBattle}
        battleStarted={battleStarted}
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Add from Spotify</Text>
        <Text style={styles.panelMeta}>
          {searchMode === 'backend' ? 'Spotify backend search' : 'Mock Spotify search'} - up to {MAX_ROOM_PICKS} bands
        </Text>
        {roomIsFull ? (
          <Text style={styles.errorText}>
            This room is full. Remove a band before adding another one.
          </Text>
        ) : null}
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search artist or album"
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />
        {searching ? <Text style={styles.statusText}>Searching Spotify...</Text> : null}
        {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
        <View style={styles.resultList}>
          {searchResults.map((pick) => {
            const isAdded = sharedList.some((item) => item.id === pick.id);

            return (
              <Pressable
                key={pick.id}
                disabled={isAdded || battleStarted || roomIsFull}
                onPress={() => onAddPick(pick)}
                style={[styles.resultRow, isAdded && styles.resultRowAdded]}
              >
                <AlbumArtwork pick={pick} size="small" />
                <View style={styles.resultText}>
                  <Text style={styles.artist}>{pick.artist}</Text>
                  <Text style={styles.album}>{pick.album}</Text>
                </View>
                <Text style={styles.addLabel}>
                  {isAdded ? 'Added' : battleStarted ? 'Locked' : roomIsFull ? 'Full' : 'Add'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={[styles.panelHeader, styles.sharedListHeader]}>
          <View style={styles.panelHeaderText}>
            <Text style={styles.panelTitle}>Shared list</Text>
            <Text style={styles.panelMeta}>
              {sharedList.length} of {MAX_ROOM_PICKS} bands ready - {spotsLeft} spots left
            </Text>
          </View>
          {isCurrentUserHost ? (
            <View style={styles.startAction}>
              <Pressable
                disabled={!canStartBattle}
                onPress={onStartBattle}
                style={[styles.primaryButton, !canStartBattle && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>Start battle</Text>
              </Pressable>
              {startBattleHint ? (
                <Text style={styles.actionHint}>{startBattleHint}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.hostOnlyText}>Host starts battle</Text>
          )}
        </View>

        <View style={styles.capacityTrack}>
          <View style={[styles.capacityFill, { width: `${capacityPercent}%` }]} />
        </View>

        <TextInput
          value={sharedListQuery}
          onChangeText={setSharedListQuery}
          placeholder="Find a band in the shared list"
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />
        {normalizedSharedListQuery ? (
          <Text style={styles.panelMeta}>
            {filteredSharedList.length} matching {filteredSharedList.length === 1 ? 'band' : 'bands'}
          </Text>
        ) : null}

        {visibleSharedList.map((pick) => (
          <View key={pick.id} style={styles.pickRow}>
            <View style={styles.pickText}>
              <Text style={styles.artist}>{pick.artist}</Text>
              <Text style={styles.album}>
                {pick.album} - added by {pick.addedBy}
              </Text>
            </View>
            <Pressable disabled={battleStarted} onPress={() => onRemovePick(pick.id)}>
              <Text style={[styles.removeText, battleStarted && styles.lockedText]}>
                {battleStarted ? 'Locked' : 'Remove'}
              </Text>
            </Pressable>
          </View>
        ))}
        {hiddenSharedListCount > 0 ? (
          <Text style={styles.previewLimitText}>
            Showing first {SHARED_LIST_PREVIEW_LIMIT}. {hiddenSharedListCount} more {normalizedSharedListQuery ? 'matching ' : ''}bands are saved for the battle.
          </Text>
        ) : null}
        {sharedList.length > 0 && filteredSharedList.length === 0 ? (
          <Text style={styles.emptyListText}>
            No bands match that search.
          </Text>
        ) : null}
        {sharedList.length === 0 ? (
          <Text style={styles.emptyListText}>
            No picks yet. Search Spotify and add the first band.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function getStartBattleHint(picksCount: number, battleStarted: boolean, canStartBattle: boolean) {
  if (canStartBattle) {
    return null;
  }

  if (picksCount < 2) {
    return 'Add at least two bands before starting.';
  }

  if (battleStarted) {
    return 'Battle already started. Run another battle from the winner screen.';
  }

  return 'The room is not ready to start yet.';
}

function RoomStatusPanel({
  members,
  selectedMemberId,
  sharedList,
  canStartBattle,
  battleStarted,
}: {
  members: RoomMember[];
  selectedMemberId: string;
  sharedList: MusicPick[];
  canStartBattle: boolean;
  battleStarted: boolean;
}) {
  const selectedMember = members.find((member) => member.id === selectedMemberId);
  const host = members.find((member) => member.isHost);
  const status = battleStarted
    ? 'Battle is locked'
    : canStartBattle
      ? 'Ready when the host is'
      : 'Waiting for at least two picks';

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.panelTitle}>Room status</Text>
          <Text style={styles.panelMeta}>{status}</Text>
        </View>
        <Text style={styles.statusBadge}>{members.length} friends</Text>
      </View>

      <View style={styles.statusGrid}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>You</Text>
          <Text style={styles.statusValue}>{selectedMember?.name ?? 'Friend'}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Host</Text>
          <Text style={styles.statusValue}>{host?.name ?? 'Host'}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Picks</Text>
          <Text style={styles.statusValue}>{sharedList.length}</Text>
        </View>
      </View>

      <View style={styles.memberProgressList}>
        {members.map((member) => {
          const picksCount = sharedList.filter((pick) => pick.addedBy === member.name).length;

          return (
            <View key={member.id} style={styles.memberProgressRow}>
              <Text style={styles.memberProgressName}>
                {member.name}
                {member.isHost ? ' host' : ''}
              </Text>
              <Text style={styles.memberProgressCount}>
                {picksCount} {picksCount === 1 ? 'pick' : 'picks'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BattleScreen({
  battleQueue,
  champion,
  currentMatch,
  currentMemberId,
  majorityNeeded,
  matchVotes,
  members,
  round,
  battleHistory,
  voteHistory,
  voteCounts,
  matchIsTied,
  canStartBattle,
  isCurrentUserHost,
  onPlay,
  onResolveTie,
  onStartBattle,
  onVote,
}: {
  battleQueue: MusicPick[];
  champion: MusicPick | null;
  currentMatch: [MusicPick, MusicPick] | null;
  currentMemberId: string;
  majorityNeeded: number;
  matchVotes: MatchVotes;
  members: RoomMember[];
  round: number;
  battleHistory: BattleHistoryItem[];
  voteHistory: string[];
  voteCounts: Record<string, number>;
  matchIsTied: boolean;
  canStartBattle: boolean;
  isCurrentUserHost: boolean;
  onPlay: (pick: MusicPick) => void;
  onResolveTie: (pick: MusicPick) => void;
  onStartBattle: () => void;
  onVote: (friend: string, pick: MusicPick) => void;
}) {
  const votedCount = Object.keys(matchVotes).length;
  const currentMember = members.find((member) => member.id === currentMemberId);
  const currentMemberVote = currentMember ? matchVotes[currentMember.id] : undefined;
  const activeBandsCount = battleQueue.length + (currentMatch ? currentMatch.length : 0);
  const votesStillNeeded = Math.max(majorityNeeded - Math.max(...Object.values(voteCounts), 0), 0);
  const waitingMembers = members.filter((member) => !matchVotes[member.id]);
  const recentHistory = battleHistory.slice(-BATTLE_HISTORY_PREVIEW_LIMIT).reverse();

  return (
    <View style={styles.battlePanel}>
      <Text style={styles.panelTitle}>Current battle</Text>

      {!currentMatch && !champion ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyBattle}>
            Add at least two bands, then start the battle to begin voting.
          </Text>
          {isCurrentUserHost ? (
            <View style={styles.startAction}>
              <Pressable
                disabled={!canStartBattle}
                onPress={onStartBattle}
                style={[styles.primaryButton, !canStartBattle && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>Start battle</Text>
              </Pressable>
              {!canStartBattle ? (
                <Text style={styles.actionHint}>Add at least two bands before starting.</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.hostOnlyText}>Waiting for the host to start the battle.</Text>
          )}
        </View>
      ) : null}

      {currentMatch ? (
        <View>
          <Text style={styles.roundLabel}>
            Round {round} - random battle, first to {majorityNeeded} votes stays alive
          </Text>
          <Text style={styles.voteStatus}>
            {votedCount} of {members.length} friends voted. {votesStillNeeded} more {votesStillNeeded === 1 ? 'vote' : 'votes'} needed for a band to survive.
          </Text>
          {waitingMembers.length > 0 ? (
            <Text style={styles.waitingStatus}>
              Waiting on {waitingMembers.map((member) => member.name).join(', ')}
            </Text>
          ) : null}
          <Text style={styles.voteStatus}>
            {activeBandsCount} bands are still alive.
          </Text>
          <View style={styles.battleStatsRow}>
            <View style={styles.battleStat}>
              <Text style={styles.statusLabel}>Alive</Text>
              <Text style={styles.statusValue}>{activeBandsCount}</Text>
            </View>
            <View style={styles.battleStat}>
              <Text style={styles.statusLabel}>Eliminated</Text>
              <Text style={styles.statusValue}>{battleHistory.length}</Text>
            </View>
            <View style={styles.battleStat}>
              <Text style={styles.statusLabel}>Rounds</Text>
              <Text style={styles.statusValue}>{round}</Text>
            </View>
          </View>
          <View style={styles.matchup}>
            <BattleCard
              pick={currentMatch[0]}
              votes={voteCounts[currentMatch[0].id] ?? 0}
              onPlay={() => onPlay(currentMatch[0])}
            />
            <Text style={styles.versus}>VS</Text>
            <BattleCard
              pick={currentMatch[1]}
              votes={voteCounts[currentMatch[1].id] ?? 0}
              onPlay={() => onPlay(currentMatch[1])}
            />
          </View>
          <View style={styles.panelInset}>
            <Text style={styles.panelTitle}>Your vote</Text>
            {currentMember ? (
              <View style={styles.voteRow}>
                <View style={styles.voteFriend}>
                  <Text style={styles.artist}>{currentMember.name}</Text>
                  <Text style={styles.album}>
                    {currentMemberVote ? 'Vote locked for this round' : 'Choose the winner'}
                  </Text>
                </View>
                <View style={styles.voteOptions}>
                  {currentMatch.map((pick) => (
                    <Pressable
                      key={pick.id}
                      disabled={Boolean(currentMemberVote)}
                      onPress={() => onVote(currentMember.id, pick)}
                      style={[
                        styles.voteChip,
                        currentMemberVote === pick.id && styles.voteChipActive,
                        Boolean(currentMemberVote) &&
                          currentMemberVote !== pick.id &&
                          styles.voteChipDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.voteChipText,
                          currentMemberVote === pick.id && styles.voteChipTextActive,
                        ]}
                      >
                        {pick.artist}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.panelInset}>
            <Text style={styles.panelTitle}>Room votes</Text>
            {members.map((member) => (
              <View key={member.id} style={styles.memberVoteRow}>
                <Text style={styles.artist}>{member.name}</Text>
                <Text style={matchVotes[member.id] ? styles.votedBadge : styles.waitingBadge}>
                  {matchVotes[member.id] ? 'Voted' : 'Waiting'}
                </Text>
              </View>
            ))}
          </View>

          {matchIsTied ? (
            <View style={styles.panelInset}>
              <Text style={styles.panelTitle}>Tiebreaker</Text>
              <Text style={styles.emptyListText}>
                Everyone has voted and no band reached a majority.
              </Text>
              {isCurrentUserHost ? (
                <View style={styles.voteOptions}>
                  {currentMatch.map((pick) => (
                    <Pressable
                      key={`tie-${pick.id}`}
                      onPress={() => onResolveTie(pick)}
                      style={styles.voteChip}
                    >
                      <Text style={styles.voteChipText}>Keep {pick.artist}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.hostOnlyText}>Waiting for the host to resolve the tie.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.panelInset}>
            <Text style={styles.panelTitle}>Battle history</Text>
            {recentHistory.length > 0 ? (
              recentHistory.map((item) => <HistoryRow key={`round-${item.round}`} item={item} />)
            ) : (
              <Text style={styles.emptyListText}>No battles completed yet.</Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function WinnerScreen({
  battleHistory,
  champion,
  isCurrentUserHost,
  voteHistory,
  onPlay,
  onReset,
  onShare,
}: {
  battleHistory: BattleHistoryItem[];
  champion: MusicPick;
  isCurrentUserHost: boolean;
  voteHistory: string[];
  onPlay: () => void;
  onReset: () => void;
  onShare: () => void;
}) {
  const [historyQuery, setHistoryQuery] = useState('');
  const normalizedHistoryQuery = historyQuery.trim().toLowerCase();
  const filteredHistory = normalizedHistoryQuery
    ? battleHistory.filter((item) =>
        `${item.round} ${item.winner.artist} ${item.winner.album} ${item.loser.artist} ${item.loser.album} ${item.summary}`
          .toLowerCase()
          .includes(normalizedHistoryQuery),
      )
    : battleHistory;
  const visibleHistory = filteredHistory.slice(-WINNER_HISTORY_PREVIEW_LIMIT).reverse();
  const hiddenHistoryCount = Math.max(filteredHistory.length - visibleHistory.length, 0);

  return (
    <View>
      <View style={styles.winnerBox}>
        <Text style={styles.winnerLabel}>Winner</Text>
        <Text style={styles.winnerName}>{champion.artist}</Text>
        <Text style={styles.winnerAlbum}>{champion.album}</Text>
        <View style={styles.battleActions}>
          <Pressable onPress={onPlay} style={styles.playButton}>
            <Text style={styles.playButtonText}>Play winner in Spotify</Text>
          </Pressable>
          <Pressable onPress={onShare} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Share result</Text>
          </Pressable>
          {isCurrentUserHost ? (
            <Pressable onPress={onReset} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Run another battle</Text>
            </Pressable>
          ) : (
            <Text style={styles.hostOnlyText}>Host can start another battle.</Text>
          )}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Battle history</Text>
        <Text style={styles.panelMeta}>
          {voteHistory.length} completed {voteHistory.length === 1 ? 'battle' : 'battles'}
        </Text>
        <TextInput
          value={historyQuery}
          onChangeText={setHistoryQuery}
          placeholder="Find a battle in the history"
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />
        {normalizedHistoryQuery ? (
          <Text style={styles.panelMeta}>
            {filteredHistory.length} matching {filteredHistory.length === 1 ? 'battle' : 'battles'}
          </Text>
        ) : null}
        {visibleHistory.map((item, index) => (
          <HistoryRow key={`winner-round-${item.round}-${index}`} item={item} />
        ))}
        {hiddenHistoryCount > 0 ? (
          <Text style={styles.previewLimitText}>
            Showing latest {WINNER_HISTORY_PREVIEW_LIMIT}. {hiddenHistoryCount} more {normalizedHistoryQuery ? 'matching ' : ''}battles are saved in history.
          </Text>
        ) : null}
        {voteHistory.length > 0 && filteredHistory.length === 0 ? (
          <Text style={styles.emptyListText}>No battles match that search.</Text>
        ) : null}
      </View>
    </View>
  );
}

function HistoryRow({ item }: { item: BattleHistoryItem }) {
  return (
    <View style={styles.historyRow}>
      <Text style={styles.historyRound}>Round {item.round}</Text>
      <Text style={styles.historyItem}>{item.summary}</Text>
      <Text style={styles.historyMeta}>
        {item.winner.album} beat {item.loser.album} - {item.winnerVotes} to {item.loserVotes}
      </Text>
    </View>
  );
}

function BattleCard({
  pick,
  votes,
  onPlay,
}: {
  pick: MusicPick;
  votes: number;
  onPlay: () => void;
}) {
  return (
    <View style={styles.battleCard}>
      <AlbumArtwork pick={pick} size="large" />
      <Text style={styles.battleArtist}>{pick.artist}</Text>
      <Text style={styles.battleAlbum}>{pick.album}</Text>
      <Text style={styles.tallyText}>{votes} votes</Text>
      <View style={styles.battleActions}>
        <Pressable onPress={onPlay} style={styles.playButton}>
          <Text style={styles.playButtonText}>Play in Spotify</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AlbumArtwork({ pick, size }: { pick: MusicPick; size: 'small' | 'large' }) {
  const containerStyle = size === 'large' ? styles.largeAlbumArt : styles.albumArt;
  const textStyle = size === 'large' ? styles.largeAlbumArtText : styles.albumArtText;

  if (pick.artworkUrl) {
    return (
      <Image
        source={{ uri: pick.artworkUrl }}
        style={containerStyle}
        accessibilityLabel={`${pick.album} artwork`}
      />
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{pick.artist.slice(0, 1)}</Text>
    </View>
  );
}

const colors = {
  background: '#08090f',
  surface: '#11131d',
  surfaceStrong: '#181b2a',
  surfaceRaised: '#202437',
  stage: '#141725',
  accent: '#1ed760',
  accentStrong: '#13b755',
  accentSoft: '#102a1b',
  violet: '#8b5cf6',
  violetSoft: '#221a38',
  text: '#f8fafc',
  muted: '#a7b0c0',
  subtle: '#697386',
  border: '#2b3044',
  borderStrong: '#3b4260',
  danger: '#fb7185',
  warning: '#facc15',
  buttonText: '#04130a',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  hero: {
    gap: 12,
    paddingTop: 28,
    paddingBottom: 20,
  },
  header: {
    gap: 14,
    paddingTop: 22,
    paddingBottom: 6,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 44,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  nowPlaying: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    padding: 12,
  },
  nowPlayingLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  nowPlayingText: {
    marginTop: 4,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  tabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  tabText: {
    color: colors.muted,
    fontWeight: '900',
  },
  tabTextActive: {
    color: colors.accent,
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberBadge: {
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  memberBadgeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  panel: {
    gap: 14,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 16,
  },
  battlePanel: {
    gap: 14,
    marginTop: 14,
    marginBottom: 24,
    borderRadius: 8,
    backgroundColor: colors.stage,
    padding: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sharedListHeader: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  panelHeaderText: {
    flex: 1,
    minWidth: 180,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  panelMeta: {
    marginTop: 3,
    color: colors.subtle,
    fontSize: 13,
    fontWeight: '700',
  },
  statusText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '900',
  },
  readyBadge: {
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '900',
  },
  setupBadge: {
    borderRadius: 8,
    backgroundColor: colors.violetSoft,
    color: colors.warning,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '900',
  },
  setupRows: {
    gap: 8,
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  setupLabel: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: '900',
  },
  setupValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'right',
  },
  setupHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statusItem: {
    flex: 1,
    minHeight: 66,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    padding: 10,
  },
  statusLabel: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statusValue: {
    marginTop: 5,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  memberProgressList: {
    gap: 8,
  },
  memberProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
  },
  memberProgressName: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  memberProgressCount: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  capacityTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  capacityFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  hostOnlyText: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'right',
  },
  startAction: {
    width: '100%',
    maxWidth: 180,
    gap: 8,
  },
  actionHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'right',
  },
  friendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendPill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  friendPillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  friendPillText: {
    color: colors.muted,
    fontWeight: '800',
  },
  friendPillTextActive: {
    color: colors.accent,
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  resultList: {
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
  },
  resultRowAdded: {
    opacity: 0.62,
  },
  albumArt: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  albumArtText: {
    color: colors.buttonText,
    fontSize: 20,
    fontWeight: '900',
  },
  resultText: {
    flex: 1,
  },
  artist: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  album: {
    marginTop: 3,
    color: colors.subtle,
    fontSize: 14,
    lineHeight: 19,
  },
  addLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: colors.buttonText,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.35,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  pickText: {
    flex: 1,
  },
  removeText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  refreshText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  shareText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  lockedText: {
    color: colors.subtle,
  },
  previewLimitText: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    paddingTop: 12,
  },
  emptyListText: {
    color: colors.subtle,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    gap: 12,
  },
  emptyBattle: {
    color: colors.accentStrong,
    fontSize: 15,
    lineHeight: 22,
  },
  roundLabel: {
    marginBottom: 12,
    color: colors.accentStrong,
    fontSize: 14,
    fontWeight: '800',
  },
  voteStatus: {
    marginBottom: 12,
    color: colors.accent,
    fontSize: 14,
    lineHeight: 20,
  },
  waitingStatus: {
    marginBottom: 12,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  battleStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  battleStat: {
    flex: 1,
    minHeight: 62,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceStrong,
    padding: 10,
  },
  matchup: {
    gap: 12,
  },
  battleCard: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceStrong,
    padding: 16,
  },
  battleActions: {
    width: '100%',
    gap: 8,
    marginTop: 14,
  },
  playButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  playButtonText: {
    color: colors.buttonText,
    fontWeight: '900',
  },
  voteButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  largeAlbumArt: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  largeAlbumArtText: {
    color: colors.buttonText,
    fontSize: 42,
    fontWeight: '900',
  },
  battleArtist: {
    marginTop: 12,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  battleAlbum: {
    marginTop: 4,
    color: colors.accentStrong,
    fontSize: 15,
    textAlign: 'center',
  },
  tallyText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  panelInset: {
    gap: 12,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceStrong,
    padding: 14,
  },
  voteRow: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: 12,
  },
  voteFriend: {
    gap: 2,
  },
  memberVoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: 12,
  },
  votedBadge: {
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '900',
  },
  waitingBadge: {
    borderRadius: 8,
    backgroundColor: colors.border,
    color: colors.muted,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '900',
  },
  voteOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  voteChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  voteChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  voteChipDisabled: {
    opacity: 0.35,
  },
  voteChipText: {
    color: colors.accentStrong,
    fontSize: 13,
    fontWeight: '900',
  },
  voteChipTextActive: {
    color: colors.accent,
  },
  voteText: {
    color: colors.accent,
    fontWeight: '900',
  },
  versus: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  winnerBox: {
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    padding: 18,
  },
  winnerLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  winnerName: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  winnerAlbum: {
    color: colors.accentStrong,
    fontSize: 16,
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: '900',
  },
  historyItem: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  historyRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  historyRound: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  historyMeta: {
    marginTop: 3,
    color: colors.subtle,
    fontSize: 13,
    lineHeight: 18,
  },
});
