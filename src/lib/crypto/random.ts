/**
 * Cryptographically secure random primitives.
 *
 * Every security-sensitive random value in this project is produced here.
 * `Math.random()` is never used: it is not cryptographically secure and its
 * output is predictable given a small number of observed values.
 *
 * The central problem is *unbiased* selection. Mapping a random 32-bit integer
 * onto a range with `%` introduces modulo bias — some outcomes become slightly
 * more likely than others. We use rejection sampling instead, which makes every
 * outcome exactly equally likely.
 */

/** Throws unless the Web Crypto API is usable. */
export function assertCryptoAvailable(): void {
  if (
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.getRandomValues !== "function"
  ) {
    throw new Error(
      "The Web Crypto API is unavailable. A secure context (HTTPS or localhost) is required.",
    );
  }
}

/** Fills a Uint32Array with cryptographically secure random values. */
export function randomUint32Array(length: number): Uint32Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError("length must be a positive integer");
  }
  assertCryptoAvailable();
  return globalThis.crypto.getRandomValues(new Uint32Array(length));
}

/**
 * Returns a uniformly distributed integer in [0, maxExclusive).
 *
 * Rejection sampling: the largest multiple of `maxExclusive` that fits in
 * 2^32 is `limit`. Any draw at or above `limit` is discarded and redrawn,
 * which removes the bias that a naive modulo would introduce.
 */
export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive integer");
  }

  // Only 2^32 is available; wider ranges are not supported by Uint32Array.
  if (maxExclusive > 0x1_0000_0000) {
    throw new RangeError("maxExclusive exceeds 2^32");
  }

  assertCryptoAvailable();

  // A single value is exactly uniform with no rejection needed.
  if (maxExclusive === 1) return 0;

  // Largest multiple of maxExclusive that fits in the 2^32 domain.
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;

  const buffer = new Uint32Array(1);

  // In the worst case (maxExclusive near 2^31) fewer than half the draws are
  // rejected, so this terminates quickly. The bound is a safety net only.
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    globalThis.crypto.getRandomValues(buffer);
    if (buffer[0] < limit) {
      return buffer[0] % maxExclusive;
    }
  }

  throw new Error("Could not produce a uniform random integer");
}

/** Uniformly picks one element of a non-empty array. */
export function randomChoice<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new RangeError("Cannot choose from an empty array");
  }
  return items[randomInt(items.length)]!;
}

/**
 * Fisher–Yates shuffle driven by the CSPRNG.
 *
 * Runs from the end downwards, swapping each index with a uniformly chosen
 * earlier index. This produces a uniformly random permutation; the common
 * `for (i = 0; i < n - 1; i++) swap(i, i + rand(n-i))` variant is subtly
 * biased and is avoided here.
 *
 * The input array is NOT mutated.
 */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }

  return result;
}

/**
 * Uniformly samples `count` distinct elements, in random order.
 *
 * A PARTIAL Fisher–Yates: only the first `count` positions are shuffled, so
 * drawing 8 words from a 7,776-word list costs 8 CSPRNG draws instead of 7,775.
 * Selecting uniformly from the untouched tail at each step is what keeps the
 * result unbiased — the remaining elements stay equally likely at every draw.
 *
 * Distributionally identical to `secureShuffle(items).slice(0, count)`, but
 * `secureShuffle` copies and shuffles the whole list, which is ~1,000x more
 * expensive for a small sample. Prefer this one whenever `count` is much
 * smaller than `items.length`.
 *
 * The input array is NOT mutated.
 */
export function secureSample<T>(items: readonly T[], count: number): T[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("count must be a non-negative integer");
  }

  if (count > items.length) {
    throw new RangeError("count must not exceed the number of items");
  }

  const pool = [...items];
  const picked: T[] = [];

  for (let i = 0; i < count; i += 1) {
    // Pick uniformly from the not-yet-selected tail [i, pool.length).
    // `pool.length - i` is always >= 1 here because count <= items.length.
    const j = i + randomInt(pool.length - i);
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
    picked.push(pool[i]!);
  }

  return picked;
}