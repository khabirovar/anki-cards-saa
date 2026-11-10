"""Pure helpers for turning source documents into vocabulary candidates."""
import math
import re
import unicodedata
from collections import defaultdict
from collections.abc import Callable
from html.parser import HTMLParser

MIN_WORD_LENGTH = 3

_SKIPPED_TAGS = {"script", "style", "noscript", "svg", "template"}
_BLOCK_TAGS = {
    "p", "div", "li", "ul", "ol", "br", "tr", "td", "th", "table", "section", "article",
    "header", "footer", "nav", "main", "aside", "dt", "dd", "blockquote", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6",
}
_TOKEN = re.compile(r"[A-Za-z]+(?:-[A-Za-z]+)*")
# Sentence ends and line breaks: bigrams and "first word of a sentence" stop here.
_SENTENCE_BREAK = re.compile(r"[.!?;:]\s|[\r\n]+")


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _SKIPPED_TAGS:
            self._skip_depth += 1
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIPPED_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip_depth:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    parser.close()
    return "".join(parser.parts)


def drop_boilerplate(docs: dict[str, str], min_docs: int) -> dict[str, str]:
    """Remove lines that appear in at least `min_docs` documents.

    Every FAQ page carries the same menus and footer; left in, their words
    would outrank the real vocabulary just by being on every page.
    """
    def lines(text: str) -> list[str]:
        return [" ".join(line.split()) for line in text.splitlines() if line.strip()]

    seen_in: dict[str, int] = defaultdict(int)
    for text in docs.values():
        for line in set(lines(text)):
            seen_in[line] += 1
    return {
        name: "\n".join(line for line in lines(text) if seen_in[line] < min_docs)
        for name, text in docs.items()
    }


def tokenize(text: str) -> list[str]:
    # NFKC turns PDF ligatures ("ﬁ" in "conﬁgure") into plain letters; left
    # alone they split words into fragments like "con" + "gure".
    return _TOKEN.findall(unicodedata.normalize("NFKC", text))


def _sentences(text: str) -> list[list[str]]:
    return [tokens for chunk in _SENTENCE_BREAK.split(text) if (tokens := tokenize(chunk))]


def count_words(docs: dict[str, str], lemmatize: Callable[[str], str]) -> dict[str, dict]:
    """Per lemma: total count, number of documents and how often it is capitalised.

    A high cap_ratio marks proper names (Lambda, Glacier). The first word of a
    sentence is capitalised anyway, so it only counts when a word is never
    seen anywhere else.
    """
    stats: dict[str, dict] = defaultdict(lambda: {"count": 0, "docs": set(), "caps": 0, "mid": 0, "caps_mid": 0})
    for name, text in docs.items():
        for sentence in _sentences(text):
            for i, token in enumerate(sentence):
                if len(token) < MIN_WORD_LENGTH:
                    continue
                row = stats[lemmatize(token.lower())]
                capitalised = token[0].isupper()
                row["count"] += 1
                row["docs"].add(name)
                row["caps"] += capitalised
                if i > 0:
                    row["mid"] += 1
                    row["caps_mid"] += capitalised
    return {
        lemma: {
            "count": row["count"],
            "docs": len(row["docs"]),
            "cap_ratio": row["caps_mid"] / row["mid"] if row["mid"] else row["caps"] / row["count"],
        }
        for lemma, row in stats.items()
    }


def count_bigrams(docs: dict[str, str], lemmatize: Callable[[str], str], stopwords: set[str]) -> dict[str, dict]:
    """Adjacent lowercase word pairs within a sentence, keyed by "word lemma".

    Only the second word is lemmatised ("read replicas" -> "read replica"):
    that is the head noun of most English compound terms.
    """
    stats: dict[str, dict] = defaultdict(lambda: {"count": 0, "docs": set()})

    def usable(token: str) -> bool:
        return len(token) >= MIN_WORD_LENGTH and token.islower() and token not in stopwords

    for name, text in docs.items():
        for sentence in _sentences(text):
            for first, second in zip(sentence, sentence[1:]):
                if usable(first) and usable(second):
                    row = stats[f"{first} {lemmatize(second)}"]
                    row["count"] += 1
                    row["docs"].add(name)
    return {key: {"count": row["count"], "docs": len(row["docs"])} for key, row in stats.items()}


# Words missing from the frequency list get zipf 0; treat them as merely rare
# instead of infinitely rare, or every typo and PDF fragment would rank first.
MIN_ZIPF = 1.0


def keyness(count: int, total: int, zipf: float) -> float:
    """How many times (log10) more often a word appears in the corpus than in English at large.

    Zipf is log10 of occurrences per billion words, so 10**zipf / 1e9 is the
    word's share of everyday English.
    """
    corpus_share = count / total
    english_share = 10 ** max(zipf, MIN_ZIPF) / 1e9
    return math.log10(corpus_share / english_share)


# Context sentences shorter than this are headings or fragments; longer ones
# are run-on table rows from PDF extraction.
MIN_CONTEXT_WORDS = 8
MAX_CONTEXT_WORDS = 40
_PARAGRAPH_BREAK = re.compile(r"\n\s*\n")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> list[str]:
    """Sentences of a document; single line breaks are PDF/HTML wrapping, blank lines end a paragraph."""
    sentences = []
    for paragraph in _PARAGRAPH_BREAK.split(unicodedata.normalize("NFKC", text)):
        joined = " ".join(paragraph.split())
        sentences += [s for s in _SENTENCE_END.split(joined) if s]
    return sentences


def _matcher(word: str, lemmatize: Callable[[str], str]) -> Callable[[str], bool]:
    target = word.lower()
    if " " in target:
        # Terms: the phrase itself, any case, with an optional plural ending.
        pattern = re.compile(r"\b" + r"\s+".join(map(re.escape, target.split())) + r"(?:s|es)?\b", re.IGNORECASE)
        return lambda sentence: bool(pattern.search(sentence))
    return lambda sentence: any(t.lower() == target or lemmatize(t.lower()) == target for t in tokenize(sentence))


def find_contexts(sentences: list[tuple[str, str]], word: str, lemmatize: Callable[[str], str], limit: int = 3) -> list[tuple[str, str]]:
    """Up to `limit` (document, sentence) pairs using `word`, spread over different documents."""
    matches = _matcher(word, lemmatize)
    found = [
        (doc, sentence)
        for doc, sentence in sentences
        if MIN_CONTEXT_WORDS <= len(sentence.split()) <= MAX_CONTEXT_WORDS and matches(sentence)
    ]
    # Mid-length sentences carry enough context without being run-ons.
    found.sort(key=lambda pair: abs(len(pair[1].split()) - 20))
    picked: list[tuple[str, str]] = []
    for pair in found:
        if len(picked) < limit and pair[0] not in {doc for doc, _ in picked}:
            picked.append(pair)
    for pair in found:
        if len(picked) < limit and pair not in picked:
            picked.append(pair)
    return picked


def longest_shared_run(sentence: str, source: str) -> int:
    """Length in words of the longest word sequence `sentence` shares with `source`.

    Used to check that card sentences are written anew rather than copied
    from AWS texts.
    """
    a = [t.lower() for t in tokenize(sentence)]
    b = [t.lower() for t in tokenize(source)]
    best = 0
    previous = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        current = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                current[j] = previous[j - 1] + 1
                best = max(best, current[j])
        previous = current
    return best
