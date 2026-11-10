import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, chunkKeys, emptyProgress, fromCloudItems, getBox, metaKey, pickNewer, setBox, toCloudItems } from "./progress";
import type { Progress } from "./progress";

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

describe("getBox / setBox", () => {
  it("treats ids beyond the stored string as new cards", () => {
    expect(getBox("", 0)).toBe(0);
    expect(getBox("21", 5)).toBe(0);
  });

  it("stores a box at the card id, padding the gap with new cards", () => {
    const boxes = setBox("", 4, 3);
    expect(boxes).toBe("00003");
    expect(getBox(boxes, 4)).toBe(3);
    expect(getBox(setBox(boxes, 1, 5), 1)).toBe(5);
    expect(getBox(setBox(boxes, 1, 5), 4)).toBe(3);
  });
});

describe("cloud items", () => {
  const progress: Progress = { boxes: setBox("", 9, 2), session: 7, updatedAt: 1_700_000_000_000 };

  it("round-trips progress through cloud items", () => {
    expect(fromCloudItems("en-ru", toCloudItems("en-ru", progress))).toEqual(progress);
  });

  it("keeps the two modes under different keys", () => {
    const enru = Object.keys(toCloudItems("en-ru", progress));
    const ruen = Object.keys(toCloudItems("ru-en", progress));
    expect(enru.filter((k) => ruen.includes(k))).toEqual([]);
    expect(enru).toContain(metaKey("en-ru"));
  });

  it("splits long progress into chunks that fit the CloudStorage value limit", () => {
    const long: Progress = { boxes: "1".repeat(CHUNK_SIZE + 10), session: 1, updatedAt: 1 };
    const items = toCloudItems("en-ru", long);
    for (const key of chunkKeys("en-ru", 2)) expect(items[key]).toBeDefined();
    expect(Object.values(items).every((v) => v.length <= 4096)).toBe(true);
    expect(fromCloudItems("en-ru", items)).toEqual(long);
  });

  it("fits a fully studied 1000-card deck in both modes within CloudStorage limits", () => {
    const full: Progress = { boxes: "5".repeat(1001), session: 9999, updatedAt: Date.now() };
    const items = { ...toCloudItems("en-ru", full), ...toCloudItems("ru-en", full) };
    const keys = Object.keys(items);
    expect(keys.length).toBeLessThanOrEqual(1024);
    expect(keys.every((k) => KEY_PATTERN.test(k))).toBe(true);
    expect(Object.values(items).every((v) => v.length <= 4096)).toBe(true);
  });

  it("returns null when nothing was saved yet (CloudStorage gives empty strings)", () => {
    expect(fromCloudItems("en-ru", { [metaKey("en-ru")]: "" })).toBeNull();
  });

  it("returns null instead of partial data when a chunk is missing or meta is corrupted", () => {
    const items = toCloudItems("en-ru", { boxes: "1".repeat(CHUNK_SIZE + 1), session: 1, updatedAt: 1 });
    const [, second] = chunkKeys("en-ru", 2);
    expect(fromCloudItems("en-ru", { ...items, [second]: "" })).toBeNull();
    expect(fromCloudItems("en-ru", { ...items, [metaKey("en-ru")]: "{oops" })).toBeNull();
  });
});

describe("pickNewer", () => {
  const local: Progress = { boxes: "1", session: 1, updatedAt: 100 };

  it("prefers the copy saved later", () => {
    const cloud: Progress = { boxes: "2", session: 2, updatedAt: 200 };
    expect(pickNewer(local, cloud)).toBe(cloud);
    expect(pickNewer(cloud, local)).toBe(cloud);
  });

  it("keeps local progress when the cloud has nothing", () => {
    expect(pickNewer(local, null)).toBe(local);
    expect(pickNewer(emptyProgress, null)).toBe(emptyProgress);
  });
});
