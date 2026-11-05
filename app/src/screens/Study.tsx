import { useState } from "preact/hooks";
import type { Card, StudyMode } from "../types/card";
import { getFaces } from "../lib/cardFace";
import { flipHaptic } from "../lib/haptics";
import { FlipCard } from "../components/FlipCard";

interface StudyProps {
  cards: Card[];
  mode: StudyMode;
}

export function Study({ cards, mode }: StudyProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  function handleFlip() {
    setFlipped((prev) => !prev);
    flipHaptic();
  }

  function handleNext() {
    setFlipped(false);
    setIndex((prev) => (prev + 1) % cards.length);
  }

  return (
    <div class="screen study">
      <div class="study-position">
        {index + 1}/{cards.length}
      </div>
      {/* Keyed by card: a remount starts the next card unflipped with no
          animation, otherwise the flip back would show its answer for a moment. */}
      <FlipCard key={card.id} faces={getFaces(card, mode)} flipped={flipped} onFlip={handleFlip} />
      <div class="study-actions">
        {flipped ? (
          <button class="study-button" onClick={handleNext}>
            Дальше
          </button>
        ) : (
          <div class="study-hint">Нажми на карточку, чтобы перевернуть</div>
        )}
      </div>
    </div>
  );
}
