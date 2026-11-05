import type { CardFace, CardFaces } from "../lib/cardFace";
import { parseMarked } from "../lib/cardFace";

interface FlipCardProps {
  faces: CardFaces;
  flipped: boolean;
  onFlip: () => void;
}

function Face({ face, side, hidden }: { face: CardFace; side: "front" | "back"; hidden: boolean }) {
  return (
    <span class={`flip-face flip-face-${side}`} aria-hidden={hidden}>
      <span class="flip-headline">{face.headline}</span>
      <span class="flip-sentence">
        {parseMarked(face.sentence).map((segment, i) =>
          segment.marked ? <mark key={i}>{segment.text}</mark> : <span key={i}>{segment.text}</span>,
        )}
      </span>
      {face.note && <span class="flip-note">{face.note}</span>}
    </span>
  );
}

export function FlipCard({ faces, flipped, onFlip }: FlipCardProps) {
  return (
    <button class="flip-card" onClick={onFlip}>
      <span class={flipped ? "flip-inner flip-inner-flipped" : "flip-inner"}>
        <Face face={faces.front} side="front" hidden={flipped} />
        <Face face={faces.back} side="back" hidden={!flipped} />
      </span>
    </button>
  );
}
