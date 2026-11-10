import type { StudyMode } from "../types/card";
import { emptyProgress, type Progress } from "./progress";
import { clearCloudProgress, loadCloudProgress, saveCloudProgress, type CloudStorageLike } from "./cloudProgress";
import { getTg } from "./telegram";

// localStorage is written on every change and is the copy the app runs on;
// CloudStorage lags behind by a few seconds and exists to carry progress
// between devices. Outside Telegram only localStorage is used.

const CLOUD_SAVE_DELAY_MS = 3000;

function localKey(mode: StudyMode): string {
  return `anki:progress:${mode}`;
}

export function loadLocal(mode: StudyMode): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(localKey(mode)) ?? "null") as Progress | null;
    if (parsed && typeof parsed.boxes === "string" && Number.isInteger(parsed.session) && Number.isInteger(parsed.updatedAt)) {
      return parsed;
    }
  } catch {
    // corrupted or blocked storage: start fresh, the cloud copy may still win
  }
  return emptyProgress;
}

export function saveLocal(mode: StudyMode, progress: Progress): void {
  try {
    localStorage.setItem(localKey(mode), JSON.stringify(progress));
  } catch {
    // blocked storage (private mode): progress lives only in memory and cloud
  }
}

function cloud(): CloudStorageLike | null {
  const tg = getTg();
  try {
    return tg?.CloudStorage && tg.isVersionAtLeast?.("6.9") ? tg.CloudStorage : null;
  } catch {
    return null;
  }
}

export function loadRemote(mode: StudyMode): Promise<Progress | null> {
  const storage = cloud();
  return storage ? loadCloudProgress(storage, mode) : Promise.resolve(null);
}

const pending = new Map<StudyMode, Progress>();
let timer: ReturnType<typeof setTimeout> | undefined;
// Saves run one after another so two snapshots of the same mode never
// interleave their setItem calls.
let chain: Promise<void> = Promise.resolve();

function enqueue(task: (storage: CloudStorageLike) => Promise<void>): void {
  const storage = cloud();
  if (!storage) return;
  chain = chain.then(() => task(storage)).catch((err) => console.warn("CloudStorage sync failed", err));
}

export function scheduleRemoteSave(mode: StudyMode, progress: Progress): void {
  pending.set(mode, progress);
  clearTimeout(timer);
  timer = setTimeout(flushRemoteSaves, CLOUD_SAVE_DELAY_MS);
}

export function flushRemoteSaves(): void {
  clearTimeout(timer);
  for (const [mode, progress] of pending) {
    enqueue((storage) => saveCloudProgress(storage, mode, progress));
  }
  pending.clear();
}

// Writes the reset state rather than leaving the cloud empty, so other devices
// see a newer copy and drop their old progress too.
export function resetRemote(mode: StudyMode, progress: Progress): void {
  pending.delete(mode);
  enqueue(async (storage) => {
    await clearCloudProgress(storage, mode);
    await saveCloudProgress(storage, mode, progress);
  });
}
