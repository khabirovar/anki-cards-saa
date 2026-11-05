export type CardKind = "general" | "term";

export type StudyMode = "en-ru" | "ru-en";

export interface Card {
  // Stable and append-only: progress is stored by this id, so it must never be
  // reassigned or reused, even when a card is removed from the deck.
  id: number;
  word: string;
  pos: string;
  kind: CardKind;
  translationRu: string;
  // Sentences wrap the studied word form in *asterisks* for highlighting: the
  // form can differ from `word` ("durable" vs "надёжное").
  sentenceEn: string;
  sentenceRu: string;
  noteRu: string | null;
}
