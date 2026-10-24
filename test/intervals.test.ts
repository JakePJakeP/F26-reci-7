import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

// Recitation Part 2 (groups) and problem set Task 2.
// Read the spec in src/intervals/mergeIntervals.ts, then check your progress
// with `npm run mutants:intervals`.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The output is sorted.
// (invariant, algebraic, metamorphic, differential, or conditional)

const copyIntervals = (xs: readonly Interval[]): Interval[] => xs.map(([start, end]) => [start, end]);

const covers = (xs: readonly Interval[], point: number) =>
  xs.some(([start, end]) => start <= point && point <= end);

// Endpoints are built as start + non-negative width, so start <= end always.
const bandInterval: fc.Arbitrary<Interval> = fc
  .tuple(fc.integer({ min: 5000, max: 5080 }), fc.integer({ min: 0, max: 12 }))
  .map(([start, width]) => [start, start + width]);

// Specification boundaries, held far apart so one case cannot mask another:
// digit-length and negative ordering, a shared endpoint, integer neighbors,
// a contained interval, an interval that sticks out, and a duplicate.
const specificationCases = (): Interval[] => [
  [9, 9],
  [10, 12],
  [-5, -4],
  [-1, 0],
  [1000, 1003],
  [1003, 1008],
  [2000, 2002],
  [2003, 2006],
  [3000, 3020],
  [3005, 3007],
  [4000, 4004],
  [4002, 4015],
  [6000, 6000],
  [6000, 6000],
];

const richList: fc.Arbitrary<Interval[]> = fc
  .array(bandInterval, { minLength: 0, maxLength: 4 })
  .chain(extra => {
    const all = [...specificationCases(), ...extra];
    return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length });
  });

const intervalList: fc.Arbitrary<Interval[]> = fc.oneof(
  { weight: 1, arbitrary: fc.constant([] as Interval[]) },
  { weight: 8, arbitrary: richList },
);

// Already non-overlapping and non-touching: the next start is exactly one
// past the previous end, then the list is shuffled.
const alreadyDisjoint: fc.Arbitrary<{ input: Interval[]; expected: Interval[] }> = fc
  .tuple(
    fc.integer({ min: -30, max: 30 }),
    fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 2, maxLength: 6 }),
  )
  .chain(([origin, widths]) => {
    const expected: Interval[] = [];
    let cursor = origin;
    for (const width of widths) {
      expected.push([cursor, cursor + width]);
      cursor += width + 1;
    }
    return fc
      .shuffledSubarray(expected, { minLength: expected.length, maxLength: expected.length })
      .map(shuffled => ({
        input: shuffled.map(([start, end]) => [start, end] as Interval),
        expected,
      }));
  });

const reorderedList = intervalList.chain(xs =>
  fc
    .shuffledSubarray(copyIntervals(xs), { minLength: xs.length, maxLength: xs.length })
    .map(shuffled => ({ original: copyIntervals(xs), shuffled })),
);

const samplePoints = (input: readonly Interval[], output: readonly Interval[]) => {
  const points: number[] = [];
  for (const [start, end] of [...input, ...output]) {
    points.push(start, end, start - 1, end + 1, start + 0.5, end - 0.5, (start + end) / 2);
  }
  for (let i = 0; i + 1 < output.length; i++) points.push((output[i][1] + output[i + 1][0]) / 2);
  return points;
};

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (const [start, end] of xs) {
          expect(out.some(([a, b]) => a <= start && end <= b)).toBe(true);
        }
      }),
    );
  });

  // Pattern: invariant. The output is sorted and consecutive intervals neither overlap nor touch.
  it('returns intervals sorted and separated by a gap', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(copyIntervals(xs));
        for (let i = 0; i < out.length; i++) {
          expect(out[i][0]).toBeLessThanOrEqual(out[i][1]);
          if (i + 1 < out.length) expect(out[i][1]).toBeLessThan(out[i + 1][0]);
        }
      }),
    );
  });

  // Pattern: invariant. The input array and its intervals are not modified.
  it('does not modify the input intervals', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const before = copyIntervals(xs);
        mergeIntervals(xs);
        expect(xs).toEqual(before);
      }),
    );
  });

  // Pattern: differential. A sampled point is covered by the output exactly when the input covers it.
  it('covers exactly the same points as the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const input = copyIntervals(xs);
        const out = mergeIntervals(copyIntervals(xs));
        for (const point of samplePoints(input, out)) {
          expect(covers(out, point)).toBe(covers(input, point));
        }
      }),
    );
  });

  // Pattern: metamorphic. Reordering the input does not change the merged result.
  it('reordering the input does not change the result', () => {
    fc.assert(
      fc.property(reorderedList, ({ original, shuffled }) => {
        expect(mergeIntervals(shuffled)).toEqual(mergeIntervals(original));
      }),
    );
  });

  // Pattern: algebraic. Merging an already merged list changes nothing.
  it('merging an already merged list changes nothing', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const once = mergeIntervals(copyIntervals(xs));
        const twice = mergeIntervals(copyIntervals(once));
        expect(twice).toEqual(once);
      }),
    );
  });

  // Pattern: conditional. Already disjoint, non-touching intervals come back sorted and otherwise unchanged.
  it('returns already disjoint intervals sorted and unchanged', () => {
    fc.assert(
      fc.property(alreadyDisjoint, ({ input, expected }) => {
        expect(mergeIntervals(input)).toEqual(expected);
      }),
    );
  });
});
