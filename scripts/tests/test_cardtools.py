import unittest

from cardtools import check_against_wordlist, merge_batches, validate_cards


def card(**overrides) -> dict:
    base = {
        "id": 1,
        "word": "durable",
        "pos": "adj",
        "kind": "general",
        "translationRu": "надёжный",
        "sentenceEn": "S3 is *durable*.",
        "sentenceRu": "S3 *надёжен*.",
        "noteRu": None,
    }
    return {**base, **overrides}


class ValidateCardsTest(unittest.TestCase):
    def test_accepts_a_valid_deck(self):
        term = card(id=2, word="failover", kind="term", noteRu="Переключение на резерв.")
        self.assertEqual(validate_cards([card(), term]), [])

    def test_reports_duplicate_ids_and_words(self):
        errors = validate_cards([card(), card(word="other"), card(id=3, word="Durable")])
        self.assertTrue(any("id 1" in e and "duplicate" in e for e in errors), errors)
        self.assertTrue(any("durable" in e.lower() and "duplicate" in e for e in errors), errors)

    def test_requires_exactly_one_marked_word_in_each_sentence(self):
        for sentence in ["S3 is durable.", "*S3* is *durable*.", "S3 is *durable."]:
            with self.subTest(sentence=sentence):
                self.assertTrue(validate_cards([card(sentenceEn=sentence)]))
        self.assertTrue(validate_cards([card(sentenceRu="S3 надёжен.")]))

    def test_requires_filled_fields_and_known_kind(self):
        self.assertTrue(validate_cards([card(translationRu="  ")]))
        self.assertTrue(validate_cards([card(kind="slang")]))
        self.assertTrue(validate_cards([card(id=0)]))
        missing = card()
        del missing["pos"]
        self.assertTrue(validate_cards([missing]))

    def test_requires_a_note_for_terms(self):
        self.assertTrue(validate_cards([card(kind="term", noteRu=None)]))


class CheckAgainstWordlistTest(unittest.TestCase):
    wordlist = [{"id": 1, "word": "durable", "kind": "general"}, {"id": 2, "word": "failover", "kind": "term"}]

    def test_accepts_cards_matching_the_wordlist(self):
        self.assertEqual(check_against_wordlist([card()], self.wordlist), [])

    def test_reports_unknown_ids_and_mismatched_words_or_kinds(self):
        self.assertTrue(check_against_wordlist([card(id=9)], self.wordlist))
        self.assertTrue(check_against_wordlist([card(word="sturdy")], self.wordlist))
        self.assertTrue(check_against_wordlist([card(kind="term", noteRu="x")], self.wordlist))


class MergeBatchesTest(unittest.TestCase):
    def test_merges_batches_sorted_by_id(self):
        cards, errors = merge_batches({"b.json": [card(id=3, word="c")], "a.json": [card(id=1), card(id=2, word="b")]})
        self.assertEqual(errors, [])
        self.assertEqual([c["id"] for c in cards], [1, 2, 3])

    def test_reports_an_id_present_in_two_batches(self):
        _, errors = merge_batches({"a.json": [card()], "b.json": [card(word="other")]})
        self.assertTrue(any("a.json" in e and "b.json" in e for e in errors), errors)


if __name__ == "__main__":
    unittest.main()
