import unittest

from selection import select_entries

FIXED = [{"id": 1, "word": "durable", "kind": "general"}, {"id": 2, "word": "failover", "kind": "term"}]


def run(words, terms=(), existing=(), exclude=(), rename=None, target=10):
    return select_entries(list(words), list(terms), FIXED, list(existing), set(exclude), rename or {}, target)


def words_of(entries):
    return [e["word"] for e in entries]


class SelectEntriesTest(unittest.TestCase):
    def test_keeps_fixed_entries_with_their_ids_first(self):
        entries = run(["latency", "ingest"])
        self.assertEqual(entries[:2], FIXED)
        self.assertEqual([e["id"] for e in entries], [1, 2, 3, 4])

    def test_applies_exclusions_and_renames_and_drops_duplicates(self):
        entries = run(["com", "fine-grain", "Durable", "failover", "latency"], exclude={"com"}, rename={"fine-grain": "fine-grained"})
        self.assertEqual(words_of(entries), ["durable", "failover", "fine-grained", "latency"])

    def test_keeps_the_spelling_of_terms_but_dedupes_case_insensitively(self):
        entries = run(["latency"], terms=["NAT gateway", "nat gateway", "Failover"])
        self.assertIn("NAT gateway", words_of(entries))
        self.assertEqual(words_of(entries).count("NAT gateway"), 1)
        self.assertNotIn("Failover", words_of(entries))

    def test_keeps_every_curated_term_and_fills_the_rest_with_general_words(self):
        entries = run(["w1", "w2", "w3", "w4"], terms=["t1", "t2"], target=5)
        self.assertEqual(sorted(words_of(entries[2:])), ["t1", "t2", "w1"])

    def test_stops_at_the_target_size(self):
        self.assertEqual(len(run(["a1", "a2", "a3", "a4", "a5"], target=4)), 4)

    def test_interleaves_terms_with_general_words_in_proportion(self):
        entries = run(["w1", "w2", "w3", "w4"], terms=["t1", "t2"], target=8)
        new = entries[2:]
        self.assertEqual([e["kind"] for e in new], ["general", "general", "term", "general", "general", "term"])
        self.assertEqual(words_of(new), ["w1", "w2", "t1", "w3", "w4", "t2"])

    def test_keeps_ids_from_an_existing_wordlist_and_appends_new_words_after_them(self):
        existing = FIXED + [{"id": 3, "word": "ingest", "kind": "general"}, {"id": 4, "word": "old", "kind": "general"}]
        entries = run(["latency", "ingest"], existing=existing)
        by_word = {e["word"]: e["id"] for e in entries}
        self.assertEqual(by_word["ingest"], 3)
        # "old" left the selection; its id 4 must not be handed to a new word.
        self.assertEqual(by_word["latency"], 5)
        self.assertNotIn("old", by_word)

    def test_is_stable_when_run_twice(self):
        first = run(["latency", "ingest"], terms=["read replica"])
        self.assertEqual(run(["latency", "ingest"], terms=["read replica"], existing=first), first)


if __name__ == "__main__":
    unittest.main()
