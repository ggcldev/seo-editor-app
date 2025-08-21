// src/core/outlineIndex.ts
export class OutlineIndex {
  private offsets: number[]; // sorted heading positions (pos/offset)
  
  constructor(private headings: { id: string; pos: number }[]) {
    this.offsets = headings.map(h => h.pos);
  }

  // Last heading with pos <= offset
  atOrBefore(offset: number): number {
    let lo = 0, hi = this.offsets.length; // [lo, hi)
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.offsets[mid] <= offset) lo = mid + 1;
      else hi = mid;
    }
    return Math.max(0, lo - 1);
  }

  idAtOrBefore(offset: number): string | null {
    const i = this.atOrBefore(offset);
    return this.headings[i]?.id ?? null;
  }
}