import type { StudyMode } from "../types/card";

interface HomeProps {
  cardCount: number | null;
  loadFailed: boolean;
  onRetry: () => void;
  onSelect: (mode: StudyMode) => void;
}

const OPTIONS: { mode: StudyMode; label: string }[] = [
  { mode: "en-ru", label: "English → Русский" },
  { mode: "ru-en", label: "Русский → English" },
];

export function Home({ cardCount, loadFailed, onRetry, onSelect }: HomeProps) {
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
          {OPTIONS.map((opt) => (
            <button key={opt.mode} class="home-button" disabled={!cardCount} onClick={() => onSelect(opt.mode)}>
              {opt.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
