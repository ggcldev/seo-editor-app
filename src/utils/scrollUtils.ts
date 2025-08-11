// scrollUtils.ts
export type RevealMode = 'top' | 'center' | 'third';

// Cache computed styles for performance
const STYLE_CACHE = new WeakMap<HTMLTextAreaElement, Record<string, string>>();

// Cache mirror elements to avoid create/destroy churn
const MIRRORS = new WeakMap<HTMLTextAreaElement, HTMLDivElement>();

const COPY_KEYS = [
  'boxSizing','paddingTop','paddingRight','paddingBottom','paddingLeft',
  'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
  'fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textTransform','whiteSpace'
] as const;

function copyComputed(el: HTMLTextAreaElement): Record<string, string> {
  const hit = STYLE_CACHE.get(el);
  if (hit) return hit;
  
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const k of COPY_KEYS) {
    const cssKey = k.replace(/[A-Z]/g, '-$&').toLowerCase();
    out[cssKey] = cs.getPropertyValue(cssKey);
  }
  
  STYLE_CACHE.set(el, out);
  return out;
}

function syncStyles(from: HTMLElement, to: HTMLElement) {
  const cs = getComputedStyle(from);
  for (const k of COPY_KEYS) {
    const cssKey = k.replace(/[A-Z]/g, '-$&').toLowerCase();
    to.style.setProperty(cssKey, cs.getPropertyValue(cssKey));
  }
}

function getMirror(el: HTMLTextAreaElement) {
  let m = MIRRORS.get(el);
  if (!m) {
    m = document.createElement('div');
    // Off-screen and isolated
    m.style.position = 'fixed';
    m.style.top = '-10000px';
    m.style.left = '0';
    m.style.visibility = 'hidden';
    m.style.pointerEvents = 'none';
    m.style.whiteSpace = 'pre-wrap';
    m.style.wordWrap = 'break-word';
    m.style.overflow = 'hidden';           // no own scrolling
    m.style.contain = 'layout paint style';// isolates layout calculations
    m.setAttribute('aria-hidden', 'true');
    document.body.appendChild(m);
    MIRRORS.set(el, m);
  }
  return m;
}

export function smoothScrollTo(
  el: HTMLTextAreaElement,
  target: number,
  dur = 180,
  onComplete?: () => void
) {
  const start = el.scrollTop, delta = target - start;
  if (Math.abs(delta) < 1) { el.scrollTop = target; onComplete?.(); return; }
  const t0 = performance.now();
  const ease = (t: number) => (t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t);
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / dur);
    el.scrollTop = start + delta * ease(p);
    if (p < 1) requestAnimationFrame(tick);
    else onComplete?.();
  };
  requestAnimationFrame(tick);
}

export function measureHeadingTopsBatch(
  el: HTMLTextAreaElement,
  outline: { offset: number }[]
): number[] {
  if (!outline.length) return [];
  const mirror = getMirror(el);

  // mirror should match text wrapping of textarea
  mirror.style.width = el.clientWidth + 'px';
  syncStyles(el, mirror);

  // Build once into a fragment
  const text = el.value;
  const frag = document.createDocumentFragment();
  const markers: HTMLSpanElement[] = [];
  let cursor = 0;

  for (let i = 0; i < outline.length; i++) {
    const off = outline[i].offset;
    if (off > cursor) {
      frag.appendChild(document.createTextNode(text.slice(cursor, off)));
      cursor = off;
    }
    const marker = document.createElement('span');
    marker.textContent = text[cursor] ?? ' ';
    markers.push(marker);
    frag.appendChild(marker);
  }

  // mount → read → clear (no residual giant DOM)
  mirror.textContent = '';
  mirror.appendChild(frag);

  const baseTop = mirror.getBoundingClientRect().top;
  const tops = markers.map(m => m.getBoundingClientRect().top - baseTop);

  mirror.textContent = ''; // **clear** so it never accumulates

  return tops;
}

export function scrollToOffsetExact(
  el: HTMLTextAreaElement,
  offset: number,
  mode: RevealMode = 'third',
  onComplete?: () => void
) {
  const bias = mode === 'top' ? 0 : mode === 'center' ? 0.5 : 0.33; // default: third
  const markerTop = measureOffsetTop(el, offset);
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  const target = Math.max(0, Math.min(markerTop - bias * el.clientHeight, max));
  smoothScrollTo(el, Math.round(target), 200, onComplete);
}

export function measureOffsetTop(el: HTMLTextAreaElement, offset: number) {
  const mirror = getMirror(el);
  mirror.style.width = el.clientWidth + 'px';
  syncStyles(el, mirror);

  const before = el.value.slice(0, offset);
  const after = el.value.slice(offset) || ' ';
  const marker = document.createElement('span');
  marker.textContent = after[0];

  mirror.textContent = '';
  mirror.appendChild(document.createTextNode(before));
  mirror.appendChild(marker);

  const top = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top;

  mirror.textContent = ''; // **clear**

  return top;
}