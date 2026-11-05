import type { Card, StudyMode } from "../types/card";

export interface CardFace {
  headline: string;
  sentence: string;
  note: string | null;
}

export interface CardFaces {
  front: CardFace;
  back: CardFace;
}

export interface TextSegment {
  text: string;
  marked: boolean;
}

export function getFaces(card: Card, mode: StudyMode): CardFaces {
  const english = { headline: card.word, sentence: card.sentenceEn };
  const russian = { headline: card.translationRu, sentence: card.sentenceRu };
  const [front, back] = mode === "en-ru" ? [english, russian] : [russian, english];
  return {
    front: { ...front, note: null },
    back: { ...back, note: card.noteRu },
  };
}

export function parseMarked(sentence: string): TextSegment[] {
  // split() with a capture group keeps the marked parts at odd indexes.
  return sentence
    .split(/\*([^*]+)\*/)
    .map((text, i) => ({ text, marked: i % 2 === 1 }))
    .filter((segment) => segment.text !== "");
}
