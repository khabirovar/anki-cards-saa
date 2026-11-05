import { describe, expect, it } from "vitest";
import type { Card } from "../types/card";
import { getFaces, parseMarked } from "./cardFace";

const card: Card = {
  id: 1,
  word: "failover",
  pos: "noun",
  kind: "term",
  translationRu: "аварийное переключение",
  sentenceEn: "Route 53 triggers *failover* to the standby Region.",
  sentenceRu: "Route 53 запускает *аварийное переключение* на резервный регион.",
  noteRu: "Автоматический переход на резервный ресурс при сбое основного.",
};

describe("getFaces", () => {
  it("shows English on the front and Russian on the back in en-ru mode", () => {
    const { front, back } = getFaces(card, "en-ru");
    expect(front).toEqual({ headline: card.word, sentence: card.sentenceEn, note: null });
    expect(back).toEqual({ headline: card.translationRu, sentence: card.sentenceRu, note: card.noteRu });
  });

  it("shows Russian on the front and English on the back in ru-en mode", () => {
    const { front, back } = getFaces(card, "ru-en");
    expect(front).toEqual({ headline: card.translationRu, sentence: card.sentenceRu, note: null });
    expect(back).toEqual({ headline: card.word, sentence: card.sentenceEn, note: card.noteRu });
  });

  it("never reveals the note on the front, where it would give away the answer", () => {
    expect(getFaces(card, "en-ru").front.note).toBeNull();
    expect(getFaces(card, "ru-en").front.note).toBeNull();
  });
});

describe("parseMarked", () => {
  it("splits a sentence around the marked word", () => {
    expect(parseMarked("Use a *durable* store.")).toEqual([
      { text: "Use a ", marked: false },
      { text: "durable", marked: true },
      { text: " store.", marked: false },
    ]);
  });

  it("keeps a multi-word marked phrase together", () => {
    expect(parseMarked("A *read replica* helps.")).toEqual([
      { text: "A ", marked: false },
      { text: "read replica", marked: true },
      { text: " helps.", marked: false },
    ]);
  });

  it("handles a marker at the very start and end without empty segments", () => {
    expect(parseMarked("*Throughput* grows *fast*")).toEqual([
      { text: "Throughput", marked: true },
      { text: " grows ", marked: false },
      { text: "fast", marked: true },
    ]);
  });

  it("returns plain text unchanged when there is no marker", () => {
    expect(parseMarked("No markers here.")).toEqual([{ text: "No markers here.", marked: false }]);
  });
});
