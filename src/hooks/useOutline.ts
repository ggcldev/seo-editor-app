import { useEffect, useRef, useState } from "react";
import { toId } from "../utils/ids";

export type Heading = { level: 1|2|3|4|5|6; text: string; id: string; offset: number };

export function useOutline(markdown: string): Heading[] {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../workers/outlineWorker.ts", import.meta.url), { type: "module" });
      workerRef.current.onmessage = (e: MessageEvent<any[]>) => {
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
    }
    workerRef.current!.postMessage(markdown || "");
    // keep worker alive; no cleanup needed between renders
  }, [markdown]);

  return headings;
}


