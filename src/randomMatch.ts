export function pickRandomPair<T>(items: T[], random = Math.random): [T, T] | null {
  if (items.length < 2) {
    return null;
  }

  const firstIndex = randomIndex(items.length, random);
  let secondIndex = randomIndex(items.length - 1, random);
  if (secondIndex >= firstIndex) {
    secondIndex += 1;
  }

  return [items[firstIndex], items[secondIndex]];
}

function randomIndex(length: number, random: () => number) {
  return Math.floor(random() * length);
}
