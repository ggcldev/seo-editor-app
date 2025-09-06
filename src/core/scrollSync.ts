// src/core/scrollSync.ts
import type { EditorView } from '@codemirror/view';

export class ScrollSync {
  private until = 0;
  private target: number | null = null;
  private readonly view: EditorView;
  private readonly calmBandPx: number;

  constructor(view: EditorView, calmBandPx = 36) {
    this.view = view;
    this.calmBandPx = calmBandPx;
  }

  suppress(ms = 150) { this.until = Date.now() + ms; this.target = null; }
  suppressUntilTarget(pos: number, maxMs = 800) { this.target = pos; this.until = Date.now() + maxMs; }

  // Check if currently in a simple suppression period (not target-based)
  isSimplySuppressed(now = Date.now()): boolean {
    return this.target == null && now < this.until;
  }

  // Call on each update tick; returns true when suppression is released.
  maybeRelease(now = Date.now()) {
    if (this.target == null) return now >= this.until;
    const rect = this.view.scrollDOM.getBoundingClientRect();
    const anchorPos = this.view.posAtCoords({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) ?? 0;
    if (Math.abs(anchorPos - this.target) <= this.calmBandPx || now >= this.until) {
      this.target = null;
      return true;
    }
    return false;
  }
}