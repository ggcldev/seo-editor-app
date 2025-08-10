// scrollUtils.ts
export type RevealMode = 'top' | 'center' | 'third';

// Cache computed styles for performance
const STYLE_CACHE = new WeakMap<HTMLTextAreaElement, Record<string, string>>();

function copyComputed(el: HTMLTextAreaElement): Record<string, string> {
  const hit = STYLE_CACHE.get(el);
  if (hit) return hit;
  
  const cs = getComputedStyle(el);
  const keys = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'whiteSpace'
  ];
  
  const out: Record<string, string> = {};
  for (const k of keys) {
    const cssKey = k.replace(/[A-Z]/g, '-$&').toLowerCase();
    out[cssKey] = cs.getPropertyValue(cssKey);
  }
  
  STYLE_CACHE.set(el, out);
  return out;
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

  // Build mirror once and keep appending into it
  const mirror = document.createElement('div');
  const cs = getComputedStyle(el);
  const keys = [
    'boxSizing','width','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textTransform','whiteSpace'
  ];
  for (const k of keys) {
    const cssKey = k.replace(/[A-Z]/g, '-$&').toLowerCase();
    mirror.style.setProperty(cssKey, cs.getPropertyValue(cssKey));
  }
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflow = 'auto';
  mirror.style.pointerEvents = 'none';
  mirror.style.height = cs.height;
  mirror.style.width  = cs.width;

  document.body.appendChild(mirror);

  const tops: number[] = [];
  let cursor = 0;
  const text = el.value; // use the actual textarea value to avoid drift

  for (let i = 0; i < outline.length; i++) {
    const off = outline[i].offset;

    if (off > cursor) {
      mirror.appendChild(document.createTextNode(text.slice(cursor, off)));
      cursor = off;
    }

    const marker = document.createElement('span');
    marker.textContent = text[cursor] ?? ' ';
    mirror.appendChild(marker);

    // Now marker is actually in the mounted mirror
    tops.push(marker.offsetTop);
  }

  document.body.removeChild(mirror);
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
  const mirror = document.createElement('div');
  const styleMap = copyComputed(el);
  
  // Apply cached styles
  for (const [k, v] of Object.entries(styleMap)) {
    if (v) mirror.style.setProperty(k, v);
  }
  
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflow = 'auto';
  mirror.style.pointerEvents = 'none';
  mirror.style.height = styleMap['height'] || getComputedStyle(el).height;
  mirror.style.width = styleMap['width'] || getComputedStyle(el).width;

  const before = el.value.slice(0, offset);
  const after = el.value.slice(offset) || ' ';
  const marker = document.createElement('span');
  marker.textContent = after[0];
  mirror.textContent = before;
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop; // pixel top inside mirror
  document.body.removeChild(mirror);
  return top;
}