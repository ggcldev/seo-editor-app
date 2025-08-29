// utils/ids.ts
const NON_ALNUM_DASH_SPACE = /[^-\p{Letter}\p{Number}\s]/gu;
const SPACE_RUNS = /[\s_-]+/g;

export function slugifyHeading(text: string): string {
  // Normalize, strip diacritics, keep letters/numbers across scripts
  const base = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(NON_ALNUM_DASH_SPACE, ' ')
    .replace(SPACE_RUNS, ' ')
    .trim()
    .toLowerCase()
    .replace(/ /g, '-');

  return base || 'section';
}

/** Stable, human-friendly IDs with deterministic de-dupe. */
export function makeHeadingIdStable(
  text: string,
  seen: Map<string, number>
): string {
  const slug = slugifyHeading(text);
  const n = (seen.get(slug) ?? 0) + 1;
  seen.set(slug, n);
  return n === 1 ? slug : `${slug}-${n}`;
}

// Back-compat for legacy offset-based IDs (keep, but prefer the stable API)
export function makeHeadingIdLegacy(text: string, offset: number): string {
  return `${slugifyHeading(text)}-${offset}`;
}

/**
 * Deterministic, collision-proof heading id.
 * Appends the absolute character offset so duplicate texts are distinct.
 * Example: "introduction" at offset 482 -> "introduction-482"
 * @deprecated Use makeHeadingIdStable for better stability
 */
export function makeHeadingId(text: string, offset: number): string {
  return makeHeadingIdLegacy(text, offset);
}

// Legacy function for backward compatibility
export function toId(text: string): string {
  return text.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}