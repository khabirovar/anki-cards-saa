import type { StudyMode } from "../types/card";
import type { DeckSummary } from "../lib/scheduler";

interface HomeProps {
  cardCount: number | null;
  summaries: Record<StudyMode, DeckSummary>;
  loadFailed: boolean;
  onRetry: () => void;
  onSelect: (mode: StudyMode) => void;
  onReset: () => void;
}

const OPTIONS: { mode: StudyMode; label: string }[] = [
  { mode: "en-ru", label: "English → Русский" },
  { mode: "ru-en", label: "Русский → English" },
];

export function Home({ cardCount, summaries, loadFailed, onRetry, onSelect, onReset }: HomeProps) {
  return (
    <div class="screen home">
      <div class="home-title">Слова AWS SAA</div>
      {loadFailed ? (
        <>
          <div class="home-subtitle">Не удалось загрузить карточки</div>
          <button class="home-button" onClick={onRetry}>
            Повторить
          </button>
        </>
      ) : (
        <>
          <div class="home-subtitle">{cardCount === null ? "Загрузка…" : `Карточек: ${cardCount}`}</div>
          {OPTIONS.map((opt) => {
            const summary = summaries[opt.mode];
            return (
              <button key={opt.mode} class="home-button" disabled={!cardCount} onClick={() => onSelect(opt.mode)}>
                <span class="home-button-label">{opt.label}</span>
                {!!cardCount && (
                  <span class="home-stats">
                    Новых {summary.fresh} · Учу {summary.learning} · Выучено {summary.learned}
                  </span>
                )}
              </button>
            );
          })}
          {!!cardCount && (
            <button class="home-reset" onClick={onReset}>
              Сбросить прогресс
            </button>
          )}
        </>
      )}
    </div>
  );
}
