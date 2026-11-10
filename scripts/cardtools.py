"""Pure checks and merging for card data (data/batches/*.json -> data/cards.json)."""
import re

KINDS = {"general", "term"}
TEXT_FIELDS = ["word", "pos", "translationRu", "sentenceEn", "sentenceRu"]
# The app highlights the *marked* word form; exactly one pair per sentence.
_MARK = re.compile(r"\*[^*]+\*")


def _label(card: dict) -> str:
    return f"card id {card.get('id')} ({card.get('word')!r})"


def _has_one_mark(sentence: str) -> bool:
    return len(_MARK.findall(sentence)) == 1 and sentence.count("*") == 2


def validate_cards(cards: list[dict]) -> list[str]:
    errors: list[str] = []
    ids: dict[int, int] = {}
    words: dict[str, int] = {}
    for card in cards:
        label = _label(card)
        card_id = card.get("id")
        if not isinstance(card_id, int) or isinstance(card_id, bool) or card_id < 1:
            errors.append(f"{label}: id must be a positive integer")
        for field in TEXT_FIELDS:
            value = card.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{label}: {field} must be a non-empty string")
        if card.get("kind") not in KINDS:
            errors.append(f"{label}: kind must be one of {sorted(KINDS)}")
        note = card.get("noteRu", "missing")
        if note is not None and (not isinstance(note, str) or not note.strip()):
            errors.append(f"{label}: noteRu must be null or a non-empty string")
        if card.get("kind") == "term" and not note:
            errors.append(f"{label}: terms need noteRu explaining the concept")
        for field in ["sentenceEn", "sentenceRu"]:
            if isinstance(card.get(field), str) and not _has_one_mark(card[field]):
                errors.append(f"{label}: {field} must mark exactly one *word*")
        ids[card_id] = ids.get(card_id, 0) + 1
        if isinstance(card.get("word"), str):
            key = card["word"].strip().lower()
            words[key] = words.get(key, 0) + 1
    errors += [f"id {card_id}: duplicate, used by {n} cards" for card_id, n in ids.items() if n > 1]
    errors += [f"word {word!r}: duplicate, used by {n} cards" for word, n in words.items() if n > 1]
    return errors


def check_against_wordlist(cards: list[dict], wordlist: list[dict]) -> list[str]:
    """Card ids are the progress keys, so a card must keep its wordlist id, word and kind."""
    by_id = {entry["id"]: entry for entry in wordlist}
    errors: list[str] = []
    for card in cards:
        entry = by_id.get(card.get("id"))
        if entry is None:
            errors.append(f"{_label(card)}: id is not in the wordlist")
        elif card.get("word") != entry["word"] or card.get("kind") != entry["kind"]:
            errors.append(f"{_label(card)}: wordlist has {entry['word']!r} ({entry['kind']}) for this id")
    return errors


def merge_batches(batches: dict[str, list[dict]]) -> tuple[list[dict], list[str]]:
    seen: dict[int, str] = {}
    cards: list[dict] = []
    errors: list[str] = []
    for name in sorted(batches):
        for card in batches[name]:
            card_id = card.get("id")
            if card_id in seen:
                errors.append(f"id {card_id}: in both {seen[card_id]} and {name}")
                continue
            seen[card_id] = name
            cards.append(card)
    cards.sort(key=lambda c: c.get("id") if isinstance(c.get("id"), int) else -1)
    return cards, errors
