// src/core/outlineCore.ts
import type { Heading } from './outlineParser';

export class OutlineIndex {
  readonly idToIdx = new Map<string, number>();
  readonly offsets: number[];
  readonly byLevel: number[][] = [[], [], [], [], [], [], []]; // 0..6 (use 1..6)
  readonly items: Heading[];

  constructor(items: Heading[]) {
    this.items = items;
    this.offsets = items.map(h => h.offset);
    items.forEach((h, i) => {
      this.idToIdx.set(h.id, i);
      // Clamp level to valid range (1-6) to prevent array bounds issues
      const level = Math.max(1, Math.min(6, h.level));
      this.byLevel[level].push(i);
    });
  }

  /**
   * Finds the index of the first heading at or after the given document offset.
   * 
   * Uses binary search with bit-shift optimization for O(log n) performance.
   * This is primarily used for efficient range queries and scroll synchronization.
   * 
   * @param offset - Character position in the document (0-based)
   * @returns Index of the first heading >= offset, or -1 if no headings exist
   * 
   * @example
   * ```typescript
   * // Find headings in range [100, 200]
   * const start = index.nearestByOffset(100);
   * const end = index.nearestByOffset(201);
   * const headingsInRange = index.items.slice(start, end);
   * ```
   */
  nearestByOffset(offset: number): number {
    if (this.offsets.length === 0) return -1;
    // Binary search for the first heading at or after the given offset
    let lo = 0, hi = this.offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1; // Bit shift for fast division by 2
      if (this.offsets[mid] < offset) {
        lo = mid + 1; // Target is in right half
      } else {
        hi = mid; // Target is in left half (including mid)
      }
    }
    return lo;
  }

  /**
   * Return the index of the last heading whose offset <= given offset.
   * If the offset is before the first heading, returns 0 when any heading exists, or -1 otherwise.
   * This is the stable choice for "current section" based on caret position.
   */
  indexAtOrBefore(offset: number): number {
    const n = this.offsets.length;
    if (n === 0) return -1;
    let lo = 0, hi = n - 1, ans = -1;
    // Binary search for rightmost heading where offset >= heading.offset
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.offsets[mid] <= offset) {
        ans = mid; // Valid candidate - heading is at or before offset
        lo = mid + 1; // Look for later headings that still qualify
      } else {
        hi = mid - 1; // Heading is after offset, search earlier
      }
    }
    // If no heading found at or before offset, default to first heading (prevents outline jumping)
    return ans === -1 ? 0 : ans;
  }

  /** Convenience: id of heading at or before the given offset */
  idAtOrBefore(offset: number): string | null {
    const i = this.indexAtOrBefore(offset);
    return i >= 0 && i < this.items.length ? this.items[i].id : null;
  }

  ancestorChain(idx: number): number[] {
    if (idx < 0 || idx >= this.items.length) return [];
    const chain: number[] = [];
    const items = this.items;
    let curLevel = items[idx].level;
    // Walk backwards to find parent headings (lower level numbers)
    for (let i = idx - 1; i >= 0; i--) {
      if (items[i].level < curLevel) {
        chain.push(i); // Found a parent heading
        curLevel = items[i].level; // Update current level to find grandparents
        if (curLevel === 1) break; // Stop at top-level heading
      }
    }
    // Reverse to get ancestry from root to immediate parent
    return chain.reverse();
  }

  nextByPrefix(prefix: string, startIdx = 0): number {
    if (!prefix || this.items.length === 0) return -1;
    const p = prefix.toLowerCase();
    const n = this.items.length;
    // Circular search starting from the next item after startIdx
    for (let k = 1; k <= n; k++) {
      const i = (startIdx + k) % n; // Wrap around to beginning if needed
      if (this.items[i].text.toLowerCase().startsWith(p)) return i;
    }
    return -1; // No matching heading found
  }

  // Bonus: Get all items at specific level
  itemsAtLevel(level: number): Heading[] {
    const validLevel = Math.max(1, Math.min(6, level));
    return this.byLevel[validLevel].map(idx => this.items[idx]);
  }

  // Bonus: Check if heading has children
  hasChildren(idx: number): boolean {
    if (idx < 0 || idx >= this.items.length - 1) return false;
    return this.items[idx + 1].level > this.items[idx].level;
  }
}