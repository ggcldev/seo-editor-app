// utils/eol.ts
export function normalizeEOL(s: string, ensureFinalNewline = false): string {
  let t = s.indexOf('\r') === -1 ? s : s.replace(/\r\n?/g, '\n');
  t = t.replace(/\u2028|\u2029/g, '\n');
  if (ensureFinalNewline && t.length && t[t.length - 1] !== '\n') t += '\n';
  return t;
}