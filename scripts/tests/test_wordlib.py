import unittest

from wordlib import count_bigrams, count_words, drop_boilerplate, html_to_text, tokenize


def lemma(word: str) -> str:
    return {"replicas": "replica", "zones": "zone"}.get(word, word)


class HtmlToTextTest(unittest.TestCase):
    def test_drops_scripts_and_styles_but_keeps_text(self):
        html = "<html><style>p{}</style><script>var x=1</script><p>Durable &amp; cheap</p></html>"
        self.assertEqual(html_to_text(html).split(), ["Durable", "&", "cheap"])

    def test_puts_block_elements_on_separate_lines(self):
        text = html_to_text("<div>First question</div><p>Second answer</p><li>Third</li>")
        self.assertEqual([line.strip() for line in text.splitlines() if line.strip()], ["First question", "Second answer", "Third"])


class DropBoilerplateTest(unittest.TestCase):
    def test_removes_lines_repeated_across_many_documents(self):
        docs = {
            "a": "Sign in to the Console\nS3 stores objects durably",
            "b": "Sign in to the Console\nEBS volumes are block storage",
            "c": "Sign in to the Console\nGlacier is for archives",
        }
        cleaned = drop_boilerplate(docs, min_docs=3)
        self.assertNotIn("Sign in", " ".join(cleaned.values()))
        self.assertIn("S3 stores objects durably", cleaned["a"])

    def test_keeps_lines_shared_by_fewer_documents(self):
        docs = {"a": "shared line", "b": "shared line", "c": "other"}
        self.assertIn("shared line", drop_boilerplate(docs, min_docs=3)["a"])


class TokenizeTest(unittest.TestCase):
    def test_keeps_case_and_hyphenated_words_and_skips_numbers(self):
        self.assertEqual(
            tokenize("Use Multi-AZ for cost-effective 99.99% uptime in us-east-1."),
            ["Use", "Multi-AZ", "for", "cost-effective", "uptime", "in", "us-east"],
        )


class CountWordsTest(unittest.TestCase):
    def test_counts_occurrences_documents_and_capitalisation_per_lemma(self):
        docs = {"a": "Read replicas help. replicas scale", "b": "One replica. Lambda runs code", "c": "Lambda again"}
        rows = count_words(docs, lemma)
        self.assertEqual(rows["replica"]["count"], 3)
        self.assertEqual(rows["replica"]["docs"], 2)
        self.assertEqual(rows["replica"]["cap_ratio"], 0.0)
        self.assertEqual(rows["lambda"]["cap_ratio"], 1.0)

    def test_ignores_very_short_tokens(self):
        self.assertNotIn("in", count_words({"a": "in in in"}, lemma))


class CountBigramsTest(unittest.TestCase):
    def test_counts_adjacent_lowercase_pairs_with_lemmatised_head(self):
        docs = {"a": "Add read replicas. A read replica lags", "b": "Use availability zones and read replicas"}
        rows = count_bigrams(docs, lemma, stopwords={"a", "and", "use", "add"})
        self.assertEqual(rows["read replica"]["count"], 3)
        self.assertEqual(rows["read replica"]["docs"], 2)
        self.assertEqual(rows["availability zone"]["count"], 1)

    def test_skips_pairs_with_stopwords_or_capitalised_words(self):
        rows = count_bigrams({"a": "the bucket. Amazon bucket. bucket policy"}, lemma, stopwords={"the"})
        self.assertNotIn("the bucket", rows)
        self.assertNotIn("amazon bucket", rows)
        self.assertIn("bucket policy", rows)

    def test_does_not_pair_words_across_sentence_breaks(self):
        rows = count_bigrams({"a": "store data. bucket names"}, lemma, stopwords=set())
        self.assertNotIn("data bucket", rows)


if __name__ == "__main__":
    unittest.main()
