import { getBox, setBox } from "./progress";

// Leitner boxes: 0 is a new card, 1..4 are being learned, 5 is learned.
export const MAX_BOX = 5;
export const SESSION_SIZE = 20;

export interface SessionState {
  queue: number[];
  // Cards answered "don't know" this session: they keep coming back until
  // known, but only the first answer of the session moves their box.
  failed: number[];
  knownFirstTry: number;
  total: number;
}

export interface DeckSummary {
  fresh: number;
  learning: number;
  learned: number;
}

// Box b is reviewed every 2^(b-1) sessions, so no per-card dates are stored.
export function isDue(box: number, session: number): boolean {
  return box >= 1 && session % 2 ** (box - 1) === 0;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildSession(
  ids: number[],
  boxes: string,
  session: number,
  size = SESSION_SIZE,
  random: () => number = Math.random,
): number[] {
  const byWeakest = (a: number, b: number) => getBox(boxes, a) - getBox(boxes, b) || a - b;
  const studied = ids.filter((id) => getBox(boxes, id) > 0);
  const due = studied.filter((id) => isDue(getBox(boxes, id), session)).sort(byWeakest);
  const fresh = ids.filter((id) => getBox(boxes, id) === 0);
  let picked = [...due, ...fresh].slice(0, size);
  if (picked.length === 0) {
    // Everything is studied and nothing is due this session: review the
    // weakest cards early rather than show an empty session.
    picked = [...studied].sort(byWeakest).slice(0, size);
  }
  return shuffle(picked, random);
}

export function startSession(queue: number[]): SessionState {
  return { queue, failed: [], knownFirstTry: 0, total: queue.length };
}

export function answerCard(state: SessionState, boxes: string, known: boolean): { state: SessionState; boxes: string } {
  const [id, ...rest] = state.queue;
  const firstAnswer = !state.failed.includes(id);
  if (known) {
    return {
      state: { ...state, queue: rest, knownFirstTry: state.knownFirstTry + (firstAnswer ? 1 : 0) },
      // A new card starts in box 1, so knowing it moves it to box 2 — above
      // a card answered "don't know", which lands in box 1.
      boxes: firstAnswer ? setBox(boxes, id, Math.min(Math.max(getBox(boxes, id), 1) + 1, MAX_BOX)) : boxes,
    };
  }
  return {
    state: { ...state, queue: [...rest, id], failed: firstAnswer ? [...state.failed, id] : state.failed },
    boxes: setBox(boxes, id, 1),
  };
}

export function summarize(ids: number[], boxes: string): DeckSummary {
  const summary: DeckSummary = { fresh: 0, learning: 0, learned: 0 };
  for (const id of ids) {
    const box = getBox(boxes, id);
    if (box === 0) summary.fresh++;
    else if (box === MAX_BOX) summary.learned++;
    else summary.learning++;
  }
  return summary;
}
