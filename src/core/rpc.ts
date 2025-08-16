// src/core/rpc.ts
export function createWorkerRPC<TReq extends { method: string }, TRes>(url: URL) {
  const w = new Worker(url, { type: 'module' });
  let seq = 0;
  const waits = new Map<number, (r: TRes) => void>();
  w.onmessage = (e: MessageEvent<{ id: number; result: TRes }>) => {
    const cb = waits.get(e.data.id);
    if (cb) { cb(e.data.result); waits.delete(e.data.id); }
  };
  return {
    call(payload: TReq): Promise<TRes> {
      const id = ++seq;
      (w as any).postMessage({ id, v: 1, ...payload });
      return new Promise(res => waits.set(id, res));
    },
    terminate() { w.terminate(); }
  };
}