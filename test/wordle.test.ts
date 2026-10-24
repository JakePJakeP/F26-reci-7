import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { matchGuess } from '../src/wordle';

// Recitation Part 1: follow along with your TA, filling in the todos below.
// Problem set Task 1: keep adding properties until `npm run mutants:wordle`
// kills every mutant. Read the spec in src/wordle/matchGuess.ts.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The result always has exactly five colors.
// (invariant, algebraic, metamorphic, differential, or conditional)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Repeated letters are rare over 26 letters, so count bugs hide. A small
// alphabet makes them ordinary. The full alphabet is still used below: a
// small one hides guesses whose letters are simply absent from the secret.
const SMALL = 'ABC';

const wordFrom = (letters: string) =>
  fc.array(fc.constantFrom(...letters), { minLength: 5, maxLength: 5 }).map(cs => cs.join(''));

const word = wordFrom(ALPHABET);
const smallWord = wordFrom(SMALL);

const occurrences = (text: string, letter: string) => {
  let n = 0;
  for (const ch of text) if (ch === letter) n++;
  return n;
};

// One copy of `letter` is matched at `greenAt`, and the same letter is also
// placed earlier at a different position. An early yellow must not consume it.
const earlyClaim: fc.Arbitrary<[string, string]> = fc.integer({ min: 0, max: 3 }).chain(i =>
  fc.tuple(fc.integer({ min: i + 1, max: 4 }), fc.constantFrom(...ALPHABET), word).map(
    ([greenAt, letter, base]) => {
      const secretChars = [...base];
      const filler = letter === 'Z' ? 'Y' : 'Z';
      for (let k = 0; k < 5; k++) if (secretChars[k] === letter) secretChars[k] = filler;
      secretChars[greenAt] = letter;
      const guessChars = [...secretChars];
      guessChars[i] = letter;
      return [secretChars.join(''), guessChars.join('')];
    },
  ),
);

// Distinct secret, guess uses the first letter twice and the second three
// times. Greens and yellows are then asymmetric in the two arguments.
const unbalanced: fc.Arbitrary<[string, string]> = fc
  .shuffledSubarray([...ALPHABET], { minLength: 5, maxLength: 5 })
  .map(letters => {
    const [a, b] = letters;
    return [letters.join(''), a + a + b + b + b];
  });

// Two non-matching copies of a letter the secret contains only once.
// The earlier one is yellow and the later one is black.
const leftmostYellow: fc.Arbitrary<[string, string]> = fc
  .shuffledSubarray([...ALPHABET], { minLength: 4, maxLength: 4 })
  .map(([a, b, c, d]) => [b + c + d + d + a, a + a + b + c + d]);

const wordPair = fc.oneof(
  fc.tuple(smallWord, smallWord),
  fc.tuple(word, word),
  earlyClaim,
  unbalanced,
  leftmostYellow,
);

// Guess is the secret with two different letters exchanged.
const transposition = fc
  .tuple(word, fc.integer({ min: 0, max: 3 }), fc.integer({ min: 1, max: 4 }), fc.constantFrom(...ALPHABET))
  .map(([base, i, delta, other]) => {
    const j = Math.min(4, i + delta);
    const chars = [...base];
    const a = chars[i];
    const b = other === a ? (a === 'Z' ? 'Y' : 'Z') : other;
    chars[j] = b;
    const guessChars = [...chars];
    guessChars[i] = b;
    guessChars[j] = a;
    return { secret: chars.join(''), guess: guessChars.join(''), i, j };
  });

const renaming = fc.shuffledSubarray([...ALPHABET], { minLength: ALPHABET.length, maxLength: ALPHABET.length });

const rename = (text: string, letters: string[]) => {
  const map = new Map<string, string>();
  for (let i = 0; i < ALPHABET.length; i++) map.set(ALPHABET[i], letters[i]);
  return [...text].map(ch => map.get(ch) ?? ch).join('');
};

describe('matchGuess', () => {
  // Pattern: invariant. The result always has exactly five colors.
  it('returns exactly five colors', () => {
    fc.assert(
      fc.property(wordPair, ([secret, guess]) => {
        expect(matchGuess(secret, guess)).toHaveLength(5);
      }),
    );
  });

  // Pattern: invariant. Every color is G, Y, or B.
  it('only uses the colors G, Y, B', () => {
    fc.assert(
      fc.property(wordPair, ([secret, guess]) => {
        for (const c of matchGuess(secret, guess)) expect(['G', 'Y', 'B']).toContain(c);
      }),
    );
  });

  // Pattern: invariant. A position is green exactly when the two letters match.
  it('marks a position green exactly when the letters match', () => {
    fc.assert(
      fc.property(wordPair, ([secret, guess]) => {
        const colors = matchGuess(secret, guess);
        for (let i = 0; i < 5; i++) expect(colors[i] === 'G').toBe(guess[i] === secret[i]);
      }),
    );
  });

  // Pattern: invariant. Greens and yellows for a letter never exceed its count in the secret.
  it('never credits a letter more times than the secret contains it', () => {
    fc.assert(
      fc.property(wordPair, ([secret, guess]) => {
        const colors = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          let credited = 0;
          for (let i = 0; i < 5; i++) if (guess[i] === letter && colors[i] !== 'B') credited++;
          expect(credited).toBeLessThanOrEqual(occurrences(secret, letter));
        }
      }),
    );
  });

  // Pattern: invariant. Leftover matches are yellow from left to right, then black.
  it('assigns leftover yellows from left to right', () => {
    fc.assert(
      fc.property(wordPair, ([secret, guess]) => {
        const colors = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          let greens = 0;
          const rest: number[] = [];
          for (let i = 0; i < 5; i++) {
            if (guess[i] !== letter) continue;
            if (colors[i] === 'G') greens++;
            else rest.push(i);
          }
          const budget = occurrences(secret, letter) - greens;
          for (let k = 0; k < rest.length; k++) expect(colors[rest[k]]).toBe(k < budget ? 'Y' : 'B');
        }
      }),
    );
  });

  // Pattern: conditional. Guessing the secret gives all greens.
  it('guessing the secret gives all greens', () => {
    fc.assert(
      fc.property(fc.oneof(word, smallWord), secret => {
        expect(matchGuess(secret, secret)).toEqual(['G', 'G', 'G', 'G', 'G']);
      }),
    );
  });

  // Pattern: conditional. Swapping two different letters yields yellows there and greens elsewhere.
  it('swapping two different letters marks those positions yellow', () => {
    fc.assert(
      fc.property(transposition, ({ secret, guess, i, j }) => {
        const colors = matchGuess(secret, guess);
        for (let k = 0; k < 5; k++) expect(colors[k]).toBe(k === i || k === j ? 'Y' : 'G');
      }),
    );
  });

  // Pattern: metamorphic. Renaming letters in both words preserves the colors.
  it('renaming letters in both words preserves the colors', () => {
    fc.assert(
      fc.property(word, word, renaming, (secret, guess, letters) => {
        expect(matchGuess(rename(secret, letters), rename(guess, letters))).toEqual(matchGuess(secret, guess));
      }),
    );
  });
});
