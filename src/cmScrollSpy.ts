// cmScrollSpy.ts
import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { Heading } from "./hooks/useOutline";

type GetOutline = () => Heading[];
type OnActive = (id: string | null, source: 'scroll') => void;

export function scrollSpyPlugin(
  getOutline: GetOutline,
  onActive: OnActive,
  bias: "top" | "center" | "third" = "third"
) {
  // Viewport anchor as a fraction of height
  const frac = bias === "top" ? 0 : bias === "center" ? 0.5 : 0.33;

  // Public handle we keep to call suppress() from React
  type SpyInstance = {
    suppress: (ms?: number) => void;
  };

  // Make it nullable and well-typed to avoid 'never'
  let pluginInstance: SpyInstance | null = null;

  const plugin = ViewPlugin.define(view => {
    let lastActiveId: string | null = null;
    let lastSwitchAt = 0;
    let suppressedUntil = 0;
    let raf = 0;
    let settleTimer: number | undefined;

    // keep flicker down at boundaries but don't "stick"
    const HYSTERESIS_MS = 90;
    // when no native 'scrollend', run a final settle after idle
    const SETTLE_IDLE_MS = 80;
    const supportsScrollEnd = "onscrollend" in (view.scrollDOM as HTMLElement);

    function clamp(n: number, lo: number, hi: number) {
      return Math.max(lo, Math.min(hi, n));
    }

    function pickActiveId(): string | null {
      const outline = getOutline();
      if (!outline.length) return null;

      try {
        const rect = view.scrollDOM.getBoundingClientRect();
        // Stable anchor line in the viewport (64–220 px clamp keeps it sane on small/large panes)
        const anchorY = rect.top + clamp(rect.height * frac, 64, 220);
        const coords = { x: rect.left + 12, y: anchorY };

        const res = view.posAtCoords(coords);
        if (!res) return outline[0].id;
        const anchorPos = res;

        // headings[] must be sorted by offset (doc position) ascending
        let lo = 0, hi = outline.length - 1, ans = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (outline[mid].offset <= anchorPos) { ans = mid; lo = mid + 1; }
          else { hi = mid - 1; }
        }
        return ans >= 0 ? outline[ans].id : outline[0].id;
      } catch {
        // Can't measure during updates, return current or first heading
        return lastActiveId || (outline[0]?.id ?? null);
      }
    }

    function applyActive(from: 'live' | 'settle') {
      const now = performance.now();
      if (now < suppressedUntil) {
        console.log('Scroll spy suppressed, remaining:', suppressedUntil - now);
        return;
      }

      const nextId = pickActiveId();
      if (!nextId) return;

      if (nextId !== lastActiveId) {
        // tiny hysteresis to avoid flicker when the anchor sits exactly on a boundary
        if (now - lastSwitchAt < HYSTERESIS_MS && from === 'live') return;
        lastSwitchAt = now;
        lastActiveId = nextId;
        console.log('Scroll spy active heading changed to:', nextId);
        onActive(nextId, 'scroll');
      }
    }

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => applyActive('live'));

      // schedule a final settle after momentum stops (if no native scrollend)
      if (!supportsScrollEnd) {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => applyActive('settle'), SETTLE_IDLE_MS);
      }
    };

    function onScrollEnd() {
      // one last precise pick after momentum fully stops
      applyActive('settle');
    }

    // also respond to viewport/doc structure changes
    function onUpdate(u: ViewUpdate) {
      if (u.viewportChanged || u.docChanged) {
        // Re-evaluate, e.g. headings moved
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => applyActive('live'));
      }
    }

    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true });
    if (supportsScrollEnd) {
      view.scrollDOM.addEventListener('scrollend', onScrollEnd as EventListener, { passive: true });
    }

    // initial pick (deferred to avoid measuring during editor construction)
    setTimeout(() => applyActive('settle'), 0);

    const instance = {
      suppress(ms = 900) {
        suppressedUntil = performance.now() + ms;
        console.log('Scroll spy suppressed for:', ms, 'ms');
      },
      update(u: ViewUpdate) { onUpdate(u); },
      destroy() {
        view.scrollDOM.removeEventListener('scroll', onScroll);
        if (supportsScrollEnd) {
          view.scrollDOM.removeEventListener('scrollend', onScrollEnd as EventListener);
        }
        if (raf) cancelAnimationFrame(raf);
        if (settleTimer) clearTimeout(settleTimer);
      }
    };

    pluginInstance = instance;
    return instance;
  });

  return {
    plugin,
    suppress: (ms: number = 900) => {
      pluginInstance?.suppress(ms);
    }
  };
}