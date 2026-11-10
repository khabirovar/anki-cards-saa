#!/usr/bin/env python3
"""
Flags card sentences that copy AWS source text: any run of MAX_SHARED_WORDS
or more consecutive words shared with the card's context sentences.

Run: .venv/bin/python scripts/check_overlap.py data/batches/001.json [...]
"""
import json
import sys
from pathlib import Path

from extract_contexts import CONTEXTS_JSON
from wordlib import longest_shared_run

# Short shared runs are unavoidable ("in the same Region"); six or more words
# in a row means the sentence was copied rather than written.
MAX_SHARED_WORDS = 6


def main() -> None:
    contexts = json.loads(CONTEXTS_JSON.read_text(encoding="utf-8"))
    flagged = []
    checked = 0
    for path in sys.argv[1:]:
        for card in json.loads(Path(path).read_text(encoding="utf-8")):
            checked += 1
            for ctx in contexts.get(str(card["id"]), []):
                run = longest_shared_run(card["sentenceEn"], ctx["sentence"])
                if run >= MAX_SHARED_WORDS:
                    flagged.append(f"id {card['id']} ({card['word']}): {run} words shared with {ctx['doc']}")
    if flagged:
        print("\n".join(flagged), file=sys.stderr)
        sys.exit(f"{len(flagged)} copied sentence(s) in {checked} cards")
    print(f"{checked} cards: no sentence shares {MAX_SHARED_WORDS}+ words with its sources")


if __name__ == "__main__":
    main()
