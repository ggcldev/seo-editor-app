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

  nearestByOffset(offset: number): number {
    if (this.offsets.length === 0) return -1;
    let lo = 0, hi = this.offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.offsets[mid] < offset) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  ancestorChain(idx: number): number[] {
    if (idx < 0 || idx >= this.items.length) return [];
    const chain: number[] = [];
    const items = this.items;
    let curLevel = items[idx].level;
    for (let i = idx - 1; i >= 0; i--) {
      if (items[i].level < curLevel) {
        chain.push(i);
        curLevel = items[i].level;
        if (curLevel === 1) break;
      }
    }
    return chain.reverse();
  }

  nextByPrefix(prefix: string, startIdx = 0): number {
    if (!prefix || this.items.length === 0) return -1;
    const p = prefix.toLowerCase();
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (startIdx + k) % n;
      if (this.items[i].text.toLowerCase().startsWith(p)) return i;
    }
    return -1;
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