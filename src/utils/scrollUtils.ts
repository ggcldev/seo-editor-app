// scrollUtils.ts
export type RevealMode = 'top' | 'center' | 'third';

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
  const cs = getComputedStyle(el);
  // copy layout & font-ish styles that affect wrapping
  [
    'boxSizing','width','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textTransform',
    'whiteSpace'
  ].forEach(k => {
    const value = cs.getPropertyValue(k.replace(/[A-Z]/g, '-$&').toLowerCase());
    if (value) {
      mirror.style.setProperty(k.replace(/[A-Z]/g, '-$&').toLowerCase(), value);
    }
  });
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflow = 'auto';
  mirror.style.pointerEvents = 'none';
  mirror.style.height = cs.height; // important for wrapping measurement
  mirror.style.width = cs.width;

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