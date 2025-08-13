// utils/eol.ts
export const normalizeEOL = (s: string) =>
  s.indexOf('\r') === -1 ? s : s.replace(/\r\n?/g, '\n');