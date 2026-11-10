import unittest

from wordlib import find_contexts, longest_shared_run, split_sentences


def lemma(word: str) -> str:
    return {"replicas": "replica", "provisioned": "provision", "throttling": "throttle"}.get(word, word)


LONG = "so that the application keeps running for every customer in the Region"


class SplitSentencesTest(unittest.TestCase):
    def test_splits_on_sentence_ends_and_joins_wrapped_lines(self):
        text = "Amazon S3 stores objects\ndurably across devices. Use a bucket policy!\n\nNext section"
        self.assertEqual(
            split_sentences(text),
            ["Amazon S3 stores objects durably across devices.", "Use a bucket policy!", "Next section"],
        )


class FindContextsTest(unittest.TestCase):
    def test_matches_inflected_forms_of_single_words(self):
        sentences = [("a", f"You provisioned extra capacity {LONG}."), ("b", f"Nothing relevant here at all {LONG}.")]
        self.assertEqual([s for _, s in find_contexts(sentences, "provision", lemma)], [f"You provisioned extra capacity {LONG}."])

    def test_matches_terms_case_insensitively_including_plural(self):
        sentences = [("a", f"Create two NAT gateways {LONG}."), ("b", f"A nat gateway lets instances reach out {LONG}.")]
        self.assertEqual(len(find_contexts(sentences, "NAT gateway", lemma)), 2)

    def test_skips_sentences_that_are_too_short_or_too_long(self):
        sentences = [("a", "Read replicas."), ("b", "replicas " + "word " * 60), ("c", f"Read replicas help {LONG}.")]
        self.assertEqual([d for d, _ in find_contexts(sentences, "replica", lemma)], ["c"])

    def test_prefers_different_documents_and_respects_the_limit(self):
        sentences = [("a", f"Throttling one {LONG}."), ("a", f"Throttling two {LONG}."), ("b", f"Throttling three {LONG}.")]
        found = find_contexts(sentences, "throttle", lemma, limit=2)
        self.assertEqual(sorted(d for d, _ in found), ["a", "b"])


class LongestSharedRunTest(unittest.TestCase):
    def test_counts_the_longest_run_of_shared_words_ignoring_case_and_punctuation(self):
        self.assertEqual(longest_shared_run("Use a *read replica* to scale reads.", "You can use a read replica, to scale"), 6)

    def test_is_zero_for_unrelated_text(self):
        self.assertEqual(longest_shared_run("Queues decouple services.", "Buckets store objects."), 0)


if __name__ == "__main__":
    unittest.main()
