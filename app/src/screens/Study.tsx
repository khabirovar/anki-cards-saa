import { useEffect, useState } from "preact/hooks";
import type { Card, StudyMode } from "../types/card";
import { getFaces } from "../lib/cardFace";
import { flipHaptic } from "../lib/haptics";
import { answerCard, startSession, type Answer } from "../lib/scheduler";
import { FlipCard } from "../components/FlipCard";

interface StudyProps {
  cardsById: Map<number, Card>;
  mode: StudyMode;
  queue: number[];
  boxes: string;
  onAnswer: (boxes: string) => void;
  onFinish: () => void;
  onRestart: () => void;
  onHome: () => void;
}

export function Study({ cardsById, mode, queue, boxes, onAnswer, onFinish, onRestart, onHome }: StudyProps) {
  const [session, setSession] = useState(() => startSession(queue));
  const [flipped, setFlipped] = useState(false);
  // Counts shown cards, not card ids: a card answered "don't know" can come
  // straight back, and it still needs a fresh, unflipped FlipCard.
  const [turn, setTurn] = useState(0);
  const finished = session.queue.length === 0;

  useEffect(() => {
    if (finished) onFinish();
  }, [finished]);

  function handleFlip() {
    setFlipped((prev) => !prev);
    flipHaptic();
  }

  function handleAnswer(answer: Answer) {
    const result = answerCard(session, boxes, answer);
    setSession(result.state);
    onAnswer(result.boxes);
    setFlipped(false);
    setTurn((prev) => prev + 1);
  }

  if (finished) {
    return (
      <div class="screen study-summary">
        <div class="home-title">Сессия завершена</div>
        <div class="summary-line">
          Сразу знал: {session.knownFirstTry} из {session.total}
        </div>
        {session.failed.length > 0 && <div class="summary-line">Повторял: {session.failed.length}</div>}
        <button class="study-button" onClick={onRestart}>
          Ещё сессия
        </button>
        <button class="home-button" onClick={onHome}>
          На главную
        </button>
      </div>
    );
  }

  const card = cardsById.get(session.queue[0])!;

  return (
    <div class="screen study">
      <div class="study-position">Осталось: {session.queue.length}</div>
      {/* Keyed per turn: a remount starts the next card unflipped with no
          animation, otherwise the flip back would show its answer for a moment. */}
      <FlipCard key={turn} faces={getFaces(card, mode)} flipped={flipped} onFlip={handleFlip} />
      <div class="study-actions">
        {flipped ? (
          <>
            <button class="study-button study-button-unknown" onClick={() => handleAnswer("unknown")}>
              Не знаю
            </button>
            <button class="study-button study-button-known" onClick={() => handleAnswer("known")}>
              Знаю
            </button>
          </>
        ) : (
          <div class="study-hint">Нажми на карточку, чтобы перевернуть</div>
        )}
      </div>
      <button class="study-easy" onClick={() => handleAnswer("easy")}>
        Слишком легко — больше не показывать
      </button>
    </div>
  );
}
