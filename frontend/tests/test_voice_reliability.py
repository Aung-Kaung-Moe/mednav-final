import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from voice_server import reliable_live_text


class LiveTranscriptTests(unittest.TestCase):
    def test_repeated_bpm_hallucination_is_rejected(self):
        self.assertFalse(reliable_live_text("BPM, " * 70, 2.4))

    def test_short_commands_and_measurements_are_kept(self):
        for text in ("Stop.", "Hey MEDNAV", "Health Check", "82 BPM"):
            with self.subTest(text=text):
                self.assertTrue(reliable_live_text(text, 2.4))


if __name__ == "__main__":
    unittest.main()
