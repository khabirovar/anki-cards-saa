#!/usr/bin/env python3
"""
Checks data/cards.json: field rules, one *marked* word per sentence, unique ids
and words, and agreement with data/wordlist.csv. Exits non-zero on problems.

Run: .venv/bin/python scripts/validate_cards.py
"""
import json
import sys

from build_cards import CARDS_JSON, read_wordlist
from cardtools import check_against_wordlist, validate_cards


def main() -> None:
    cards = json.loads(CARDS_JSON.read_text(encoding="utf-8"))
    errors = validate_cards(cards) + check_against_wordlist(cards, read_wordlist())
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(f"{len(errors)} problem(s) in {len(cards)} cards")
    print(f"{len(cards)} cards OK")


if __name__ == "__main__":
    main()
