import {
  type CSSProperties, type ReactNode, forwardRef, useImperativeHandle,
  useLayoutEffect, useMemo, useRef, useState
} from "react";

export type VirtualListHandle = {
  /** Ensure index is visible; if bandRows>0, only nudge when outside a comfort band */
  ensureVisible: (index: number, opts?: { bandRows?: number }) => void;
};

type Props = {
  count: number;
  rowHeight: number;            // fixed height per row in px
  overscan?: number;            // rows above/below viewport
  className?: string;
  style?: CSSProperties;
  /** Render function receives the GLOBAL index and an itemStyle with height/lineHeight set */
  children: (index: number, itemStyle: CSSProperties) => ReactNode;
};

export const VirtualList = forwardRef<VirtualListHandle, Props>(function VirtualList(
  { count, rowHeight, overscan = 24, className, style, children }, ref
) {
  const [node, setNode] = useState<HTMLDivElement | null>(null); // this div is the scroller
  const [scrollTop, setScrollTop] = useState(0);
  const [vh, setVh] = useState(0);
  const raf = useRef<number | null>(null);

  // StrictMode-safe: attach listeners when node exists
  useLayoutEffect(() => {
    if (!node) return;
    const el = node;

    const onScroll = () => {
      if (raf.current != null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        setScrollTop(el.scrollTop);
      });
    };

    const ro = new ResizeObserver(() => setVh(el.clientHeight));
    ro.observe(el);
    setVh(el.clientHeight); // initial measurement

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [node]);

  // Window math (guarantee at least 1 row)
  const rowsInView = vh ? Math.max(1, Math.ceil(vh / rowHeight)) : 1;
  const start = Math.max(0, Math.min(count, Math.floor(scrollTop / rowHeight) - overscan));
  const end   = Math.max(0, Math.min(count, start + rowsInView + overscan * 2));
  const offY  = start * rowHeight;
  const total = count * rowHeight;

  // Public API: soft-follow ensureVisible with comfort band
  useImperativeHandle(ref, () => ({
    /**
     * Smoothly scrolls to ensure the specified row is visible with optional comfort margin.
     * 
     * Uses "soft follow" behavior - only scrolls if the target row is outside the visible
     * area plus comfort band. This prevents jarring scrolls when the user is already close
     * to the target. The band creates a margin around the viewport edges.
     * 
     * @param i - Zero-based row index to make visible
     * @param opts - Options object with bandRows for comfort margin
     * @param opts.bandRows - Number of rows to use as comfort margin (default: 0)
     * 
     * @example
     * ```typescript
     * // Scroll to row 10 with 2-row margin
     * virtualListRef.current?.ensureVisible(10, { bandRows: 2 });
     * 
     * // Minimal scroll to just make row visible
     * virtualListRef.current?.ensureVisible(activeIndex);
     * ```
     */
    ensureVisible: (i: number, opts?: { bandRows?: number }) => {
      const el = node; if (!el) return;
      const band = Math.max(0, opts?.bandRows ?? 0) * rowHeight;
      const rowTop = i * rowHeight;
      const rowBot = rowTop + rowHeight;
      const vTop   = el.scrollTop + band;
      const vBot   = el.scrollTop + el.clientHeight - band;

      if (rowTop < vTop) {
        el.scrollTop = rowTop - band; // nudge up
      } else if (rowBot > vBot) {
        el.scrollTop = rowBot - el.clientHeight + band; // nudge down
      }
    }
  }), [node, rowHeight]);

  const slice = useMemo(
    () => Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k),
    [start, end]
  );

  return (
    <div
      ref={setNode}
      className={className}
      style={{
        overflow: "auto",
        height: "100%",
        contain: "content",
        overflowAnchor: "none",
        ...style
      }}
    >
      <div style={{ height: total, position: "relative" }}>
        <div style={{
          position: "absolute",
          inset: "0 0 auto 0",
          transform: `translateY(${offY}px)`,
          willChange: "transform"
        }}>
          {slice.map(i => children(i, { height: rowHeight, lineHeight: `${rowHeight}px` }))}
        </div>
      </div>
    </div>
  );
});