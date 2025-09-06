// src/core/scrollSync.ts
import type { EditorView } from '@codemirror/view';

export class ScrollSync {
  private until = 0; // Timestamp when suppression expires
  private target: number | null = null; // Document position to scroll to (null = time-based suppression)
  private readonly view: EditorView;
  private readonly calmBandPx: number; // Pixel tolerance around viewport center

  constructor(view: EditorView, calmBandPx = 36) {
    this.view = view;
    this.calmBandPx = calmBandPx; // Default 36px matches typical line height
  }

  // Simple time-based suppression (e.g., after user scroll)
  suppress(ms = 150) { this.until = Date.now() + ms; this.target = null; }
  
  // Target-based suppression (e.g., after programmatic scroll to heading)
  suppressUntilTarget(pos: number, maxMs = 800) { this.target = pos; this.until = Date.now() + maxMs; }

  // Check if currently in a simple suppression period (not target-based)
  isSimplySuppressed(now = Date.now()): boolean {
    return this.target == null && now < this.until;
  }

  // Call on each update tick; returns true when suppression is released.
  maybeRelease(now = Date.now()) {
    // Simple time-based suppression - just check timeout
    if (this.target == null) return now >= this.until;
    
    // Target-based suppression - check if target is within calm band
    const rect = this.view.scrollDOM.getBoundingClientRect();
    const mid = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; // Viewport center
    const targetCoords = this.view.coordsAtPos(this.target);
    
    if (targetCoords) {
      const dy = Math.abs(targetCoords.top - mid.y); // Distance from viewport center
      if (dy <= this.calmBandPx || now >= this.until) {
        // Target reached calm band OR timeout expired
        this.target = null;
        return true;
      }
      return false; // Still scrolling to target
    }
    
    // Target position invalid (e.g., deleted text) - fall back to timeout
    if (now >= this.until) { this.target = null; return true; }
    return false;
  }
}