const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const schema = readFileSync(join(__dirname, '..', 'backend', 'supabase', 'schema.sql'), 'utf8');

assert.match(schema, /create or replace function public\.enforce_room_pick_limit\(\)/);
assert.match(schema, /if v_pick_count >= 500 then/);
assert.match(schema, /create trigger room_picks_limit_before_insert/);
assert.match(schema, /order by random\(\)/);
assert.match(schema, /create or replace function public\.start_room_battle/);
assert.match(schema, /Only the host can start the battle/);
assert.match(schema, /create or replace function public\.cast_match_vote/);
assert.match(schema, /create or replace function public\.reset_room_battle/);
assert.match(schema, /Only the host can reset the battle/);
assert.match(schema, /create or replace function public\.resolve_match_tie/);
assert.match(schema, /Only the host can resolve a tie/);

console.log('Supabase schema smoke test passed.');
