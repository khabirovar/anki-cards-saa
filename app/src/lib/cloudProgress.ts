import type { StudyMode } from "../types/card";
import { chunkKeys, fromCloudItems, metaKey, parseMeta, toCloudItems, type Progress } from "./progress";

// The callback API of Telegram.WebApp.CloudStorage, narrowed to what we use so
// tests can pass an in-memory fake.
export interface CloudStorageLike {
  setItem(key: string, value: string, cb?: (err: unknown, ok: boolean) => void): void;
  getItem(key: string, cb: (err: unknown, value: string) => void): void;
  getItems(keys: string[], cb: (err: unknown, values: Record<string, string>) => void): void;
  removeItems(keys: string[], cb?: (err: unknown, ok: boolean) => void): void;
}

function call<T>(start: (cb: (err: unknown, value: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      start((err, value) => (err ? reject(err) : resolve(value)));
    } catch (err) {
      // Older clients throw WebAppMethodUnsupported synchronously.
      reject(err);
    }
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("CloudStorage timeout")), ms)),
  ]);
}

// Resolves to null on any failure: the local copy is always usable, so a
// missing cloud copy must never block studying.
export async function loadCloudProgress(storage: CloudStorageLike, mode: StudyMode, timeoutMs = 5000): Promise<Progress | null> {
  const load = async () => {
    const rawMeta = await call<string>((cb) => storage.getItem(metaKey(mode), cb));
    const meta = parseMeta(rawMeta);
    if (!meta) return null;
    const chunks = await call<Record<string, string>>((cb) => storage.getItems(chunkKeys(mode, meta.chunks), cb));
    return fromCloudItems(mode, { ...chunks, [metaKey(mode)]: rawMeta });
  };
  try {
    return await withTimeout(load(), timeoutMs);
  } catch {
    return null;
  }
}

export async function saveCloudProgress(storage: CloudStorageLike, mode: StudyMode, progress: Progress): Promise<void> {
  const items = toCloudItems(mode, progress);
  const meta = metaKey(mode);
  // Chunks first, meta last: meta names how many chunks to read, so an
  // interrupted save never leaves meta pointing at a chunk that was not written.
  for (const [key, value] of Object.entries(items)) {
    if (key !== meta) await call<boolean>((cb) => storage.setItem(key, value, cb));
  }
  await call<boolean>((cb) => storage.setItem(meta, items[meta], cb));
}

export async function clearCloudProgress(storage: CloudStorageLike, mode: StudyMode): Promise<void> {
  const rawMeta = await call<string>((cb) => storage.getItem(metaKey(mode), cb));
  const chunks = parseMeta(rawMeta)?.chunks ?? 0;
  await call<boolean>((cb) => storage.removeItems([metaKey(mode), ...chunkKeys(mode, chunks)], cb));
}
