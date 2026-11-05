import { useEffect, useState } from "preact/hooks";
import type { Card, StudyMode } from "./types/card";
import { loadCards } from "./lib/cardStore";
import { safeTg } from "./lib/telegram";
import { Home } from "./screens/Home";
import { Study } from "./screens/Study";

type Screen = { name: "home" } | { name: "study"; mode: StudyMode };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [cards, setCards] = useState<Card[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    loadCards()
      .then((result) => {
        if (!cancelled) setCards(result);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (screen.name === "home") {
      safeTg((w) => w.BackButton.hide());
      return;
    }
    const goBack = () => setScreen({ name: "home" });
    safeTg((w) => w.BackButton.show());
    safeTg((w) => w.BackButton.onClick(goBack));
    return () => safeTg((w) => w.BackButton.offClick(goBack));
  }, [screen]);

  if (screen.name === "study" && cards) {
    return <Study cards={cards} mode={screen.mode} />;
  }

  return (
    <Home
      cardCount={cards ? cards.length : null}
      loadFailed={loadFailed}
      onRetry={() => setLoadAttempt((prev) => prev + 1)}
      onSelect={(mode) => setScreen({ name: "study", mode })}
    />
  );
}
