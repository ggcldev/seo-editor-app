export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const st = getComputedStyle(cur);
    const oy = st.overflowY;
    const scrollable = /(auto|scroll|overlay)/.test(oy);
    if (scrollable && cur.scrollHeight > cur.clientHeight) return cur;
    cur = cur.parentElement;
  }
  // fallback: document scroller
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}