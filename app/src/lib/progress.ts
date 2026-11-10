import type { StudyMode } from "../types/card";

// Per-mode progress. `boxes` holds one Leitner box digit per card, at the
// card's id: one character per card is what lets a 1000-card deck in both
// modes fit CloudStorage (1024 keys of up to 4096 characters per user).
export interface Progress {
  boxes: string;
  session: number;
  updatedAt: number;
}

interface CloudMeta {
  session: number;
  updatedAt: number;
  chunks: number;
}

export const emptyProgress: Progress = { boxes: "", session: 0, updatedAt: 0 };
export const CHUNK_SIZE = 4096;

const MODE_KEYS: Record<StudyMode, string> = { "en-ru": "enru", "ru-en": "ruen" };

export function getBox(boxes: string, id: number): number {
  return id < boxes.length ? Number(boxes[id]) : 0;
}

export function setBox(boxes: string, id: number, box: number): string {
  const padded = boxes.padEnd(id + 1, "0");
  return padded.slice(0, id) + String(box) + padded.slice(id + 1);
}

export function metaKey(mode: StudyMode): string {
  return `progress_${MODE_KEYS[mode]}_meta`;
}

export function chunkKeys(mode: StudyMode, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `progress_${MODE_KEYS[mode]}_${i}`);
}

export function toCloudItems(mode: StudyMode, progress: Progress): Record<string, string> {
  const chunks: string[] = [];
  for (let i = 0; i < progress.boxes.length; i += CHUNK_SIZE) {
    chunks.push(progress.boxes.slice(i, i + CHUNK_SIZE));
  }
  const meta: CloudMeta = { session: progress.session, updatedAt: progress.updatedAt, chunks: chunks.length };
  const keys = chunkKeys(mode, chunks.length);
  return {
    ...Object.fromEntries(keys.map((key, i) => [key, chunks[i]])),
    [metaKey(mode)]: JSON.stringify(meta),
  };
}

export function parseMeta(raw: string | undefined): CloudMeta | null {
  if (!raw) return null;
  try {
    const meta = JSON.parse(raw) as CloudMeta;
    const valid = [meta.session, meta.updatedAt, meta.chunks].every((n) => Number.isInteger(n) && n >= 0);
    return valid ? meta : null;
  } catch {
    return null;
  }
}

export function fromCloudItems(mode: StudyMode, items: Record<string, string>): Progress | null {
  const meta = parseMeta(items[metaKey(mode)]);
  if (!meta) return null;
  const chunks = chunkKeys(mode, meta.chunks).map((key) => items[key]);
  // Every chunk but the last is full; a short or missing one means a save was
  // interrupted, and stitching it in would shift every later card's box.
  const complete = chunks.every((chunk, i) => chunk && (i === chunks.length - 1 || chunk.length === CHUNK_SIZE));
  if (!complete) return null;
  return { boxes: chunks.join(""), session: meta.session, updatedAt: meta.updatedAt };
}

export function pickNewer(local: Progress, cloud: Progress | null): Progress {
  return cloud && cloud.updatedAt > local.updatedAt ? cloud : local;
}
