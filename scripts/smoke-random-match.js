const assert = require('node:assert/strict');
require('./register-ts');

const { pickRandomPair } = require('../src/randomMatch.ts');

const items = ['a', 'b', 'c', 'd'];

assert.equal(pickRandomPair(['solo']), null);
assert.deepEqual(
  pickRandomPair(items, createRandomSequence([0, 0])),
  ['a', 'b'],
);
assert.deepEqual(
  pickRandomPair(items, createRandomSequence([0.74, 0.99])),
  ['c', 'd'],
);

for (let firstStep = 0; firstStep < 10; firstStep += 1) {
  for (let secondStep = 0; secondStep < 10; secondStep += 1) {
    const pair = pickRandomPair(items, createRandomSequence([firstStep / 10, secondStep / 10]));
    assert.ok(pair);
    assert.notEqual(pair[0], pair[1]);
  }
}

console.log('Random match smoke test passed.');

function createRandomSequence(values) {
  let index = 0;
  return () => values[index++] ?? 0;
}
