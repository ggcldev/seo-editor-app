import { useEffect, useRef, useState } from "react";
import { toId } from "../utils/ids";

export type Heading = { level: 1|2|3|4|5|6; text: string; id: string; offset: number };

export function useOutline(markdown: string): Heading[] {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const workerRef = useRef<Worker | null>(null);

  // create / teardown once
  useEffect(() => {
    const w = new Worker(new URL("../workers/outlineWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<{ level: number; text: string; offset: number }[]>) => {
      const raw = e.data as { level: number; text: string; offset: number }[];
      const seen = new Map<string, number>();
      const items: Heading[] = raw.map((h) => {
        const base = toId(h.text);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        return { level: h.level as Heading["level"], text: h.text, offset: h.offset, id };
      });
      setHeadings(items);
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, []);

  // post updates when markdown changes (with idle defer to reduce churn during typing)
  useEffect(() => {
    let idleId: number | null = null;
    const post = () => workerRef.current?.postMessage(markdown || "");
    if ('requestIdleCallback' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      idleId = (window as any).requestIdleCallback(post, { timeout: 120 });
    } else {
      idleId = window.setTimeout(post, 80);
    }
    return () => {
      if ('cancelIdleCallback' in window && idleId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).cancelIdleCallback(idleId);
      } else if (idleId) {
        clearTimeout(idleId);
      }
    };
  }, [markdown]);

  return headings;
}


