# Supabase Backend

This schema supports the app's room model:

- `rooms`: one battle room per invite code
- `room_members`: friends inside a room
- `room_picks`: Spotify albums/artists added to the shared list
- `battle_matches`: the active and historical head-to-head rounds
- `match_votes`: one vote per member per matchup
- `enforce_room_pick_limit`: trigger function that caps each room at 500 picks
- `start_room_battle`: atomic RPC that checks the host and creates the first random matchup
- `cast_match_vote`: atomic RPC that records a vote and advances/completes the battle when majority is reached
- `reset_room_battle`: atomic RPC that checks the host and clears match/vote state
- `resolve_match_tie`: atomic RPC that lets the host advance one tied band after everyone has voted

The app currently uses `src/roomRepository.ts` with a local implementation. `src/backend/supabaseRepository.ts` implements the same interface for create room with host, join room as a named member, hydrate, add/remove picks, start battle through `start_room_battle`, vote/advance/complete through `cast_match_vote`, host tiebreaks through `resolve_match_tie`, and reset through `reset_room_battle`.

The mobile app polls active Supabase rooms every 5 seconds and exposes a manual refresh action. Supabase Realtime subscriptions would be a better production replacement for polling.

After applying `schema.sql` and adding the Expo public Supabase credentials to `.env`, run this from the project root:

```bash
npm run setup:live
```

That checks that the anonymous key can reach the tables the app needs for shared room testing.

## Recommended next tables or policies

- Add auth user IDs to `room_members` when login exists.
- Review `security definer` permissions and Row Level Security policies around `cast_match_vote` before production use.
- Add realtime subscriptions for rooms, picks, matches, and votes.

## Security model

`schema.sql` enables Row Level Security and adds policies for the current anonymous invite-code model. These policies validate basic room relationships, such as members only adding picks to rooms they belong to and votes targeting picks in the active match.

This is not the final production security model. Before public launch, add Supabase Auth user IDs to `room_members` and tighten policies so users can only read and write rooms they have joined.
