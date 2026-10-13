/**
 * Web stub for the offline store.
 *
 * expo-sqlite's web build pulls in a WASM worker that Metro can't resolve,
 * which breaks web bundling. Since this is a native (Expo Go) app, we stub
 * the store on web — Metro resolves `./db.web.ts` automatically for the web
 * platform, so expo-sqlite is never imported there.
 *
 * The offline cache/queue is inert on web (the native build keeps the real
 * expo-sqlite implementation in db.ts).
 */
export async function setCache(): Promise<void> {}
export async function getCache<T = unknown>(): Promise<T | null> {
  return null;
}
export async function addQueue(): Promise<void> {}
export async function getQueue(): Promise<
  { id: number; method: string; path: string; body: string | null }[]
> {
  return [];
}
export async function removeQueue(): Promise<void> {}
export async function queueCount(): Promise<number> {
  return 0;
}
