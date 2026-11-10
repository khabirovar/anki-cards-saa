#!/usr/bin/env python3
"""
Builds data/wordlist.csv from data/candidates.csv and the decisions in
data/curation.json. Cards in data/batches/000-seed.json keep their ids.

Rerunning keeps the id of every word already in wordlist.csv: card progress
is stored by id, so ids must not move once cards are published.

Run: .venv/bin/python scripts/select_wordlist.py
"""
import csv
import json
from pathlib import Path

from selection import select_entries

ROOT = Path(__file__).resolve().parent.parent
WORDS_CSV = ROOT / "data" / "candidates.csv"
TERMS_CSV = ROOT / "data" / "candidates_terms.csv"
CURATION_JSON = ROOT / "data" / "curation.json"
SEED_JSON = ROOT / "data" / "batches" / "000-seed.json"
WORDLIST_CSV = ROOT / "data" / "wordlist.csv"

TARGET = 1000


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main() -> None:
    curation = json.loads(CURATION_JSON.read_text(encoding="utf-8"))
    candidates = [
        row
        for row in read_csv(WORDS_CSV)
        if int(row["docs"]) >= curation["min_docs"] and float(row["zipf"]) <= curation["max_zipf"]
    ]
    docs = {row["lemma"]: row["docs"] for row in candidates}
    docs.update({row["term"].lower(): row["docs"] for row in read_csv(TERMS_CSV)})
    fixed = [{"id": c["id"], "word": c["word"], "kind": c["kind"]} for c in json.loads(SEED_JSON.read_text(encoding="utf-8"))]
    existing = (
        [{"id": int(r["id"]), "word": r["word"], "kind": r["kind"]} for r in read_csv(WORDLIST_CSV)]
        if WORDLIST_CSV.exists()
        else []
    )

    entries = select_entries(
        words=[row["lemma"] for row in candidates],
        terms=curation["terms"],
        fixed=fixed,
        existing=existing,
        exclude=set(curation["exclude"]),
        rename=curation["rename"],
        target=TARGET,
    )

    with WORDLIST_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "word", "kind", "docs"])
        for entry in entries:
            writer.writerow([entry["id"], entry["word"], entry["kind"], docs.get(entry["word"].lower(), "")])
    kinds = [e["kind"] for e in entries]
    print(f"{len(entries)} entries ({kinds.count('general')} general, {kinds.count('term')} terms) -> {WORDLIST_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
