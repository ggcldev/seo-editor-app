// utils/ids.ts

// Unicode-aware regex: matches anything that's not letters, numbers, dashes, or spaces
const NON_ALNUM_DASH_SPACE = /[^-\p{Letter}\p{Number}\s]/gu;
// Matches runs of whitespace, underscores, and dashes to normalize them
const SPACE_RUNS = /[\s_-]+/g;

export function slugifyHeading(text: string): string {
  // Normalize Unicode and strip diacritics, keeping letters/numbers from all scripts
  const base = text
    .normalize('NFKD')                          // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')           // Remove combining diacritical marks
    .trim()
    .replace(NON_ALNUM_DASH_SPACE, ' ')        // Replace special chars with spaces
    .replace(SPACE_RUNS, ' ')                  // Normalize multiple spaces/dashes
    .trim()
    .toLowerCase()
    .replace(/ /g, '-');                       // Convert spaces to hyphens

  return base || 'section'; // Fallback for empty or special-char-only headings
}

/** 
 * Stable, human-friendly IDs with deterministic de-duplication.
 * Uses a counter map to ensure identical headings get unique suffixes.
 */
export function makeHeadingIdStable(
  text: string,
  seen: Map<string, number> // Tracks usage count for each base slug
): string {
  const slug = slugifyHeading(text);
  const n = (seen.get(slug) ?? 0) + 1; // Increment counter for this slug
  seen.set(slug, n);
  return n === 1 ? slug : `${slug}-${n}`; // First occurrence gets no suffix
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