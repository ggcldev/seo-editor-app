// utils/ids.ts

/** Slugify a heading for anchor/id usage (GitHub-like, ASCII-only). */
export function slugifyHeading(text: string): string {
  // Normalize whitespace and lower-case
  let slug = text
    .trim()
    .toLowerCase()
    // Remove backticks (inline code) and emphasis markers
    .replace(/[`*_~]/g, "")
    // Replace non-letters/numbers with spaces
    .replace(/[^a-z0-9\s-]/g, " ")
    // Collapse whitespace/hyphens to single spaces
    .replace(/[\s_-]+/g, " ")
    // Trim and convert spaces to hyphens
    .trim()
    .replace(/\s+/g, "-");

  // Fallback if the heading has no alphanumerics (e.g., "### ###")
  if (!slug) slug = "section";
  return slug;
}

/**
 * Deterministic, collision-proof heading id.
 * Appends the absolute character offset so duplicate texts are distinct.
 * Example: "introduction" at offset 482 -> "introduction-482"
 */
export function makeHeadingId(text: string, offset: number): string {
  return `${slugifyHeading(text)}-${offset}`;
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