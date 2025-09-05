// workers/outlineWorker.ts
import { parseOutline } from '../core/outlineParser';

self.onmessage = (e: MessageEvent<string>) => {
  const md = e.data || "";
  const out = md.trim() ? parseOutline(md) : [];
  postMessage(out);
};