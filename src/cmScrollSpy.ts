// cmScrollSpy.ts
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import type { Heading } from "./hooks/useOutline";

type GetOutline = () => Heading[]; // always returns latest outline (from React state)
type OnActive = (id: string | null) => void;

export function scrollSpyPlugin(
  getOutline: GetOutline,
  onActive: OnActive,
  bias: "top" | "center" | "third" = "third"
) {
  const frac = bias === "top" ? 0 : bias === "center" ? 0.5 : 0.33;

  return ViewPlugin.define((view: EditorView) => {
    return new class {
    private view: EditorView = view;
    private frame: number | null = null;
    private resizeObserver: ResizeObserver;
    private lastActiveId: string | null = null;
    private lastChangeTime = 0;

    constructor() {
      // run once immediately so we get an initial active heading on mount
      this.queue();
      // Use the CM scroller directly — passive + rAF coalescing.
      this.view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
      // Resize of the scroller also changes the anchor → same handler
      this.resizeObserver = new ResizeObserver(() => this.queue());
      this.resizeObserver.observe(this.view.scrollDOM);
    }

    update(_u: ViewUpdate) {
      // If the document or layout changed (typing, wrapping), recompute next frame
      // (this is cheap: posAtCoords + a binary search on outline array)
      this.queue();
    }

    destroy() {
      this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
      this.resizeObserver.disconnect();
      if (this.frame) cancelAnimationFrame(this.frame);
    }

    private onScroll = () => this.queue();

    private queue() {
      if (this.frame != null) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.compute();
      });
    }

    private compute() {
      const sc = this.view.scrollDOM;
      const rect = sc.getBoundingClientRect();
      // Anchor a bit inside the scroller to avoid seam glitches
      const y = rect.top + frac * sc.clientHeight + 8;
      const x = rect.left + 8;
      const pos = this.view.posAtCoords({ x, y }) ?? 0;

      const outline = getOutline();
      if (!outline.length) { onActive(null); return; }

      // Binary search last heading with offset <= pos
      let lo = 0, hi = outline.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (outline[mid].offset <= pos) { ans = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      const id = ans >= 0 ? outline[ans].id : outline[0].id;
      
      // Add hysteresis to prevent rapid flickering at boundaries
      const now = Date.now();
      if (id !== this.lastActiveId) {
        // If we've changed recently (within 80ms), ignore rapid changes
        if (now - this.lastChangeTime < 80) {
          return;
        }
        this.lastActiveId = id;
        this.lastChangeTime = now;
        onActive(id);
      }
    }
    }();
  });
}