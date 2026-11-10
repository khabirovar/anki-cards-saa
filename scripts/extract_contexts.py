#!/usr/bin/env python3
"""
Finds up to three real sentences from the downloaded AWS sources for every
wordlist entry and writes them to data/source/contexts.json.

The sentences are AWS text, so they stay in data/source/ (ignored by git):
cards are written anew from this context, never copied from it.

Run: .venv/bin/python scripts/extract_contexts.py
"""
import json
from collections import defaultdict

from build_cards import read_wordlist
from extract_candidates import ROOT, lemmatize, read_sources
from wordlib import find_contexts, split_sentences, tokenize

CONTEXTS_JSON = ROOT / "data" / "source" / "contexts.json"


def main() -> None:
    sentences = [(doc, s) for doc, text in read_sources().items() for s in split_sentences(text)]
    # Index sentences by every token and lemma so each word scans only the
    # sentences that can contain it, not all ~70k of them.
    index: dict[str, set[int]] = defaultdict(set)
    for i, (_, sentence) in enumerate(sentences):
        for token in tokenize(sentence):
            low = token.lower()
            index[low].add(i)
            index[lemmatize(low)].add(i)

    contexts = {}
    for entry in read_wordlist():
        key = entry["word"].lower().split()[0]
        candidates = [sentences[i] for i in sorted(index.get(key, ()))]
        found = find_contexts(candidates, entry["word"], lemmatize)
        contexts[entry["id"]] = [{"doc": doc, "sentence": sentence} for doc, sentence in found]

    CONTEXTS_JSON.write_text(json.dumps(contexts, ensure_ascii=False, indent=1), encoding="utf-8")
    missing = [i for i, found in contexts.items() if not found]
    print(f"{len(contexts) - len(missing)} of {len(contexts)} entries have context -> {CONTEXTS_JSON.relative_to(ROOT)}")
    if missing:
        print(f"no context for ids: {missing[:40]}{' ...' if len(missing) > 40 else ''}")


if __name__ == "__main__":
    main()
