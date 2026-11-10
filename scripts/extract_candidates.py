#!/usr/bin/env python3
"""
Builds vocabulary candidates from the sources downloaded by fetch_sources.sh.

Writes data/candidates.csv (single words) and data/candidates_terms.csv (two-word
terms). Both are rebuilt from scratch on every run.

Run: .venv/bin/python scripts/extract_candidates.py
"""
import csv
import subprocess
import sys
from pathlib import Path

import simplemma
from wordfreq import top_n_list, zipf_frequency

from wordlib import count_bigrams, count_words, drop_boilerplate, html_to_text

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "source"
WORDS_CSV = ROOT / "data" / "candidates.csv"
TERMS_CSV = ROOT / "data" / "candidates_terms.csv"

# A line found in this many HTML pages is site navigation, not content.
BOILERPLATE_MIN_DOCS = 5
# Zipf 5 and above is basic vocabulary ("store", "use") nobody needs a card for.
MAX_ZIPF = 4.8
MIN_WORD_COUNT = 3
# Words capitalised mid-sentence this often are product or proper names.
MAX_CAP_RATIO = 0.5
MIN_TERM_COUNT = 10
MIN_TERM_DOCS = 3
MAX_TERMS = 1500
STOPWORDS = set(top_n_list("en", 150))


def lemmatize(word: str) -> str:
    return simplemma.lemmatize(word, lang="en")


def read_sources() -> dict[str, str]:
    pages: dict[str, str] = {}
    pdfs: dict[str, str] = {}
    for path in sorted(SOURCE_DIR.iterdir()):
        if path.suffix == ".html":
            pages[path.name] = html_to_text(path.read_text(encoding="utf-8", errors="replace"))
        elif path.suffix == ".pdf":
            pdfs[path.name] = subprocess.run(
                ["pdftotext", str(path), "-"], check=True, capture_output=True, text=True
            ).stdout
    if not pages and not pdfs:
        sys.exit(f"No sources in {SOURCE_DIR}; run scripts/fetch_sources.sh first")
    return {**drop_boilerplate(pages, BOILERPLATE_MIN_DOCS), **pdfs}


def write_csv(path: Path, header: list[str], rows: list[list]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def main() -> None:
    docs = read_sources()

    words = []
    for lemma, row in count_words(docs, lemmatize).items():
        zipf = zipf_frequency(lemma, "en")
        if row["count"] >= MIN_WORD_COUNT and zipf <= MAX_ZIPF and row["cap_ratio"] < MAX_CAP_RATIO:
            words.append([lemma, row["count"], row["docs"], round(zipf, 2), round(row["cap_ratio"], 2)])
    words.sort(key=lambda r: (-r[2], -r[1], r[0]))
    write_csv(WORDS_CSV, ["lemma", "count", "docs", "zipf", "cap_ratio"], words)

    terms = [
        [term, row["count"], row["docs"]]
        for term, row in count_bigrams(docs, lemmatize, STOPWORDS).items()
        if row["count"] >= MIN_TERM_COUNT and row["docs"] >= MIN_TERM_DOCS
    ]
    terms.sort(key=lambda r: (-r[2], -r[1], r[0]))
    write_csv(TERMS_CSV, ["term", "count", "docs"], terms[:MAX_TERMS])

    print(f"{len(docs)} documents -> {len(words)} words, {min(len(terms), MAX_TERMS)} terms")


if __name__ == "__main__":
    main()
