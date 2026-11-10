"""Pure wordlist selection: candidates + curation decisions -> ordered entries with stable ids."""


def _normalise(items: list[str], exclude: set[str], rename: dict[str, str], taken: set[str]) -> list[str]:
    result = []
    for item in items:
        if item in exclude:
            continue
        # Terms keep their spelling ("NAT gateway"); duplicates are found case-insensitively.
        word = rename.get(item, item).strip()
        key = word.lower()
        if word and key not in exclude and key not in taken:
            taken.add(key)
            result.append(word)
    return result


def _interleave(general: list[str], terms: list[str]) -> list[dict]:
    # Spread terms evenly among general words by their relative position in
    # each ranked list; the app introduces new cards in id order.
    tagged = [((i + 1) / len(general), 0, word, "general") for i, word in enumerate(general)]
    tagged += [((i + 1) / len(terms), 1, word, "term") for i, word in enumerate(terms)]
    return [{"word": word, "kind": kind} for _, _, word, kind in sorted(tagged)]


def select_entries(
    words: list[str],
    terms: list[str],
    fixed: list[dict],
    existing: list[dict],
    exclude: set[str],
    rename: dict[str, str],
    target: int,
) -> list[dict]:
    """Ranked candidates -> wordlist entries.

    `fixed` entries keep their ids and come first. Words already in `existing`
    keep their ids, because card progress is stored by id; new words get ids
    after the highest id ever handed out, so a dropped word's id is never reused.
    """
    taken = {entry["word"].lower() for entry in fixed}
    term_pool = _normalise(terms, exclude, rename, taken)
    word_pool = _normalise(words, exclude, rename, taken)

    # Terms are hand-picked, so all of them go in; ranked general words fill the rest.
    room = max(target - len(fixed), 0)
    term_count = min(len(term_pool), room)
    word_count = min(len(word_pool), room - term_count)

    known_ids = {entry["word"].lower(): entry["id"] for entry in existing}
    next_id = max([entry["id"] for entry in [*fixed, *existing]], default=0) + 1
    entries = [dict(entry) for entry in fixed]
    for entry in _interleave(word_pool[:word_count], term_pool[:term_count]):
        entry_id = known_ids.get(entry["word"].lower())
        if entry_id is None:
            entry_id, next_id = next_id, next_id + 1
        entries.append({"id": entry_id, **entry})
    return sorted(entries, key=lambda e: e["id"])
