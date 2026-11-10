import { describe, expect, it } from "vitest";
import { answerCard, buildSession, HIDDEN_BOX, isDue, MAX_BOX, startSession, summarize } from "./scheduler";
import { getBox, setBox } from "./progress";

function boxesOf(entries: Record<number, number>): string {
  return Object.entries(entries).reduce((acc, [id, box]) => setBox(acc, Number(id), box), "");
}

const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

describe("isDue", () => {
  it("never schedules new cards as reviews", () => {
    expect(isDue(0, 1)).toBe(false);
  });

  it("repeats box b every 2^(b-1) sessions", () => {
    expect([1, 2, 3, 4].map((s) => isDue(1, s))).toEqual([true, true, true, true]);
    expect([1, 2, 3, 4].map((s) => isDue(2, s))).toEqual([false, true, false, true]);
    expect([1, 2, 3, 4, 8].map((s) => isDue(4, s))).toEqual([false, false, false, false, true]);
    expect([15, 16].map((s) => isDue(MAX_BOX, s))).toEqual([false, true]);
  });

  it("never schedules hidden cards", () => {
    expect([1, 2, 256, 512].map((s) => isDue(HIDDEN_BOX, s))).toEqual([false, false, false, false]);
  });
});

describe("buildSession", () => {
  const ids = [1, 2, 3, 4, 5, 6];

  it("takes due reviews and fills the rest with new cards", () => {
    // session 3: box 1 is due, box 2 is not
    const boxes = boxesOf({ 1: 1, 2: 2, 3: 1 });
    expect(sorted(buildSession(ids, boxes, 3, 4))).toEqual([1, 3, 4, 5]);
  });

  it("prefers due reviews over new cards and the weakest reviews first", () => {
    const boxes = boxesOf({ 1: 2, 2: 1, 3: 1, 4: 2 });
    expect(sorted(buildSession(ids, boxes, 2, 3))).toEqual([2, 3, 1].sort());
  });

  it("never returns more cards than the session size", () => {
    expect(buildSession(ids, "", 1, 4)).toHaveLength(4);
  });

  it("falls back to not-yet-due cards when nothing is due and nothing is new", () => {
    const boxes = boxesOf({ 1: 3, 2: 2, 3: 5 });
    expect(sorted(buildSession([1, 2, 3], boxes, 3, 2))).toEqual([1, 2]);
  });

  it("never picks hidden cards, not even to fill an otherwise empty session", () => {
    const boxes = boxesOf({ 1: HIDDEN_BOX, 2: 3, 3: HIDDEN_BOX });
    expect(buildSession([1, 2, 3], boxes, 3, 5)).toEqual([2]);
    expect(buildSession([1, 3], boxesOf({ 1: HIDDEN_BOX, 3: HIDDEN_BOX }), 3, 5)).toEqual([]);
  });
});

describe("answerCard", () => {
  it("promotes a card known on the first try and removes it from the queue", () => {
    const { state, boxes } = answerCard(startSession([7, 8]), boxesOf({ 7: 2 }), "known");
    expect(getBox(boxes, 7)).toBe(3);
    expect(state.queue).toEqual([8]);
    expect(state.knownFirstTry).toBe(1);
  });

  it("puts a new card known on the first try above a card answered 'don't know'", () => {
    let step = answerCard(startSession([7, 8]), "", "known");
    step = answerCard(step.state, step.boxes, "unknown");
    expect(getBox(step.boxes, 7)).toBe(2);
    expect(getBox(step.boxes, 8)).toBe(1);
  });

  it("does not promote past the last box", () => {
    const { boxes } = answerCard(startSession([7]), boxesOf({ 7: MAX_BOX }), "known");
    expect(getBox(boxes, 7)).toBe(MAX_BOX);
  });

  it("sends an unknown card back to box 1 and repeats it at the end of the session", () => {
    const { state, boxes } = answerCard(startSession([7, 8]), boxesOf({ 7: 4 }), "unknown");
    expect(getBox(boxes, 7)).toBe(1);
    expect(state.queue).toEqual([8, 7]);
  });

  it("does not promote a card that was failed earlier in the same session", () => {
    let step = answerCard(startSession([7]), boxesOf({ 7: 3 }), "unknown");
    step = answerCard(step.state, step.boxes, "known");
    expect(getBox(step.boxes, 7)).toBe(1);
    expect(step.state.queue).toEqual([]);
    expect(step.state.knownFirstTry).toBe(0);
    expect(step.state.total).toBe(1);
  });

  it("hides a card marked too easy and takes it out of the session", () => {
    const { state, boxes } = answerCard(startSession([7, 8]), "", "easy");
    expect(getBox(boxes, 7)).toBe(HIDDEN_BOX);
    expect(state.queue).toEqual([8]);
    expect(state.knownFirstTry).toBe(1);
  });

  it("hides a card even if it was answered 'don't know' earlier in the session", () => {
    let step = answerCard(startSession([7]), "", "unknown");
    step = answerCard(step.state, step.boxes, "easy");
    expect(getBox(step.boxes, 7)).toBe(HIDDEN_BOX);
    expect(step.state.queue).toEqual([]);
  });
});

describe("summarize", () => {
  it("counts new, learning and learned cards of the current deck", () => {
    const boxes = boxesOf({ 1: 1, 2: 4, 3: MAX_BOX, 9: 2 });
    // id 9 is not in the deck anymore and must not be counted
    expect(summarize([1, 2, 3, 4], boxes)).toEqual({ fresh: 1, learning: 2, learned: 1 });
  });

  it("counts hidden cards as learned", () => {
    expect(summarize([1, 2], boxesOf({ 1: HIDDEN_BOX }))).toEqual({ fresh: 1, learning: 0, learned: 1 });
  });
});
