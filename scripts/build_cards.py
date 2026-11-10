#!/usr/bin/env python3
"""
Merges data/batches/*.json into data/cards.json and copies it to app/public/.

Every card is checked against data/wordlist.csv (its id, word and kind must
match) and validated; nothing is written if any check fails. Wordlist entries
without a card yet are fine: the deck grows batch by batch.

Run: .venv/bin/python scripts/build_cards.py
"""
import csv
import json
import shutil
import sys
from pathlib import Path

from cardtools import check_against_wordlist, merge_batches, validate_cards

ROOT = Path(__file__).resolve().parent.parent
WORDLIST_CSV = ROOT / "data" / "wordlist.csv"
BATCH_DIR = ROOT / "data" / "batches"
CARDS_JSON = ROOT / "data" / "cards.json"
APP_COPY = ROOT / "app" / "public" / "cards.json"


def read_wordlist() -> list[dict]:
    with WORDLIST_CSV.open(encoding="utf-8", newline="") as f:
        return [{"id": int(row["id"]), "word": row["word"], "kind": row["kind"]} for row in csv.DictReader(f)]


def write_cards(path: Path, cards: list[dict]) -> None:
    # One card per line keeps diffs of a growing deck readable.
    lines = ",\n".join("  " + json.dumps(card, ensure_ascii=False) for card in cards)
    path.write_text(f"[\n{lines}\n]\n", encoding="utf-8")


def main() -> None:
    wordlist = read_wordlist()
    batches = {path.name: json.loads(path.read_text(encoding="utf-8")) for path in sorted(BATCH_DIR.glob("*.json"))}
    cards, errors = merge_batches(batches)
    errors += validate_cards(cards) + check_against_wordlist(cards, wordlist)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(f"{len(errors)} problem(s); nothing written")
    write_cards(CARDS_JSON, cards)
    shutil.copyfile(CARDS_JSON, APP_COPY)
    print(f"{len(cards)} of {len(wordlist)} wordlist entries have cards -> {CARDS_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
