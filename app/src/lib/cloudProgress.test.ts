import { describe, expect, it } from "vitest";
import { clearCloudProgress, loadCloudProgress, saveCloudProgress, type CloudStorageLike } from "./cloudProgress";
import { CHUNK_SIZE, type Progress } from "./progress";

function fakeStorage(): CloudStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    setItem(key, value, cb) {
      data.set(key, value);
      setTimeout(() => cb?.(null, true));
    },
    getItem(key, cb) {
      setTimeout(() => cb(null, data.get(key) ?? ""));
    },
    getItems(keys, cb) {
      setTimeout(() => cb(null, Object.fromEntries(keys.map((k) => [k, data.get(k) ?? ""]))));
    },
    removeItems(keys, cb) {
      keys.forEach((k) => data.delete(k));
      setTimeout(() => cb?.(null, true));
    },
  };
}

describe("cloud progress", () => {
  const progress: Progress = { boxes: "1".repeat(CHUNK_SIZE + 5), session: 3, updatedAt: 42 };

  it("loads what was saved, per mode", async () => {
    const storage = fakeStorage();
    await saveCloudProgress(storage, "en-ru", progress);
    expect(await loadCloudProgress(storage, "en-ru")).toEqual(progress);
    expect(await loadCloudProgress(storage, "ru-en")).toBeNull();
  });

  it("forgets progress after a clear", async () => {
    const storage = fakeStorage();
    await saveCloudProgress(storage, "en-ru", progress);
    await clearCloudProgress(storage, "en-ru");
    expect(await loadCloudProgress(storage, "en-ru")).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it("gives up with null when the storage never answers", async () => {
    const silent: CloudStorageLike = { ...fakeStorage(), getItem() {}, getItems() {} };
    expect(await loadCloudProgress(silent, "en-ru", 20)).toBeNull();
  });

  it("returns null when the storage reports an error", async () => {
    const broken: CloudStorageLike = { ...fakeStorage(), getItem: (_k, cb) => cb(new Error("boom"), "") };
    expect(await loadCloudProgress(broken, "en-ru")).toBeNull();
  });
});
