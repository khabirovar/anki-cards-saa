import { useEffect, useMemo, useState } from "preact/hooks";
import type { Card, StudyMode } from "./types/card";
import { loadCards } from "./lib/cardStore";
import { confirmAction, safeTg } from "./lib/telegram";
import { emptyProgress, pickNewer, type Progress } from "./lib/progress";
import { flushRemoteSaves, loadLocal, loadRemote, resetRemote, saveLocal, scheduleRemoteSave } from "./lib/progressStore";
import { buildSession, summarize } from "./lib/scheduler";
import { Home } from "./screens/Home";
import { Study } from "./screens/Study";

type Screen = { name: "home" } | { name: "study"; mode: StudyMode; queue: number[]; session: number };

const MODES: StudyMode[] = ["en-ru", "ru-en"];

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [cards, setCards] = useState<Card[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [progress, setProgress] = useState<Record<StudyMode, Progress>>(() => ({
    "en-ru": loadLocal("en-ru"),
    "ru-en": loadLocal("ru-en"),
  }));

  const cardsById = useMemo(() => new Map((cards ?? []).map((card) => [card.id, card])), [cards]);
  const ids = useMemo(() => (cards ?? []).map((card) => card.id), [cards]);

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
    for (const mode of MODES) {
      loadRemote(mode).then((remote) => setProgress((prev) => ({ ...prev, [mode]: pickNewer(prev[mode], remote) })));
    }
  }, []);

  useEffect(() => {
    for (const mode of MODES) saveLocal(mode, progress[mode]);
  }, [progress]);

  useEffect(() => {
    // Telegram can close the app at any moment; send pending progress as soon
    // as it goes to the background instead of waiting for the save delay.
    const onHide = () => document.visibilityState === "hidden" && flushRemoteSaves();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    if (screen.name === "home") {
      flushRemoteSaves();
      safeTg((w) => w.BackButton.hide());
      return;
    }
    const goBack = () => setScreen({ name: "home" });
    safeTg((w) => w.BackButton.show());
    safeTg((w) => w.BackButton.onClick(goBack));
    return () => safeTg((w) => w.BackButton.offClick(goBack));
  }, [screen]);

  function updateProgress(mode: StudyMode, next: Progress) {
    setProgress((prev) => ({ ...prev, [mode]: next }));
    scheduleRemoteSave(mode, next);
  }

  function startStudy(mode: StudyMode) {
    const current = progress[mode];
    const session = current.session + 1;
    updateProgress(mode, { ...current, session, updatedAt: Date.now() });
    setScreen({ name: "study", mode, queue: buildSession(ids, current.boxes, session), session });
  }

  async function handleReset() {
    if (!(await confirmAction("Сбросить прогресс в обоих режимах?"))) return;
    const reset = { ...emptyProgress, updatedAt: Date.now() };
    setProgress({ "en-ru": reset, "ru-en": reset });
    for (const mode of MODES) resetRemote(mode, reset);
  }

  if (screen.name === "study" && cards) {
    const { mode } = screen;
    return (
      <Study
        key={`${mode}-${screen.session}`}
        cardsById={cardsById}
        mode={mode}
        queue={screen.queue}
        boxes={progress[mode].boxes}
        onAnswer={(boxes) => updateProgress(mode, { ...progress[mode], boxes, updatedAt: Date.now() })}
        onFinish={flushRemoteSaves}
        onRestart={() => startStudy(mode)}
        onHome={() => setScreen({ name: "home" })}
      />
    );
  }

  return (
    <Home
      cardCount={cards ? cards.length : null}
      summaries={{ "en-ru": summarize(ids, progress["en-ru"].boxes), "ru-en": summarize(ids, progress["ru-en"].boxes) }}
      loadFailed={loadFailed}
      onRetry={() => setLoadAttempt((prev) => prev + 1)}
      onSelect={startStudy}
      onReset={handleReset}
    />
  );
}
