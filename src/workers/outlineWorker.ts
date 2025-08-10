// workers/outlineWorker.ts
export type WHeading = { level: 1|2|3|4|5|6; text: string; offset: number };

self.onmessage = (e: MessageEvent<string>) => {
  const md = (e.data || "").replace(/\r\n/g, "\n");
  if (!md.trim()) { (self as any).postMessage([]); return; }

  const lines = md.split("\n");
  const out: WHeading[] = [];
  let offset = 0;
  const clean = (s: string) => s.replace(/[#*_`~[\]()]/g, "").trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], next = lines[i + 1] || "";
    const atx = line.match(/^(#{1,6})\s+(.+)$/);
    if (atx) {
      const level = Math.max(1, Math.min(6, atx[1].length)) as WHeading["level"];
      const text = clean(atx[2]);
      if (text) out.push({ level, text, offset });
      offset += line.length + 1;
      continue;
    }
    const text = clean(line);
    if (/^=+\s*$/.test(next) && text) {
      out.push({ level: 1, text, offset });
      offset += line.length + 1; i++; offset += (lines[i]?.length ?? 0) + 1; continue;
    }
    if (/^-+\s*$/.test(next) && text) {
      out.push({ level: 2, text, offset });
      offset += line.length + 1; i++; offset += (lines[i]?.length ?? 0) + 1; continue;
    }
    offset += line.length + 1;
  }

  (self as any).postMessage(out);
};