const assert = require('node:assert/strict');
require('./register-ts');

const { createInviteLink, parseInviteCode } = require('../src/inviteLinks.ts');

assert.equal(createInviteLink('BAND-482'), 'battlebands://join?code=BAND-482');
assert.equal(parseInviteCode('BAND-482'), 'BAND-482');
assert.equal(createInviteLink('BAND-482193'), 'battlebands://join?code=BAND-482193');
assert.equal(parseInviteCode('BAND-482193'), 'BAND-482193');
assert.equal(parseInviteCode('band482193'), 'BAND-482193');
assert.equal(parseInviteCode('482193'), 'BAND-482193');
assert.equal(parseInviteCode(' band-482 '), 'BAND-482');
assert.equal(parseInviteCode('band482'), 'BAND-482');
assert.equal(parseInviteCode('band 482'), 'BAND-482');
assert.equal(parseInviteCode('482'), 'BAND-482');
assert.equal(parseInviteCode('Join room 482'), 'BAND-482');
assert.equal(parseInviteCode('Join room band482'), 'BAND-482');
assert.equal(parseInviteCode('Join my room with code BAND-482'), 'BAND-482');
assert.equal(
  parseInviteCode('Join my Battle of the Bands room with code BAND-482: battlebands://join?code=BAND-482'),
  'BAND-482',
);
assert.equal(parseInviteCode('battlebands://join?code=BAND-482'), 'BAND-482');
assert.equal(parseInviteCode('https://example.com/join?code=BAND-482'), null);
assert.equal(parseInviteCode(''), null);

console.log('Invite link smoke test passed.');
