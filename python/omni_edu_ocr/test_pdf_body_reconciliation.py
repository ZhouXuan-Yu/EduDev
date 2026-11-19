import unittest
from types import SimpleNamespace

from pdf_stream import matches_printed_body, printed_body_tokens


class PrintedBodyTests(unittest.TestCase):
    def test_typography_and_separate_tokens(self):
        self.assertEqual(printed_body_tokens("设 𝑅1 ＝ ５Ω"), printed_body_tokens("设R1=5Ω"))
        for left, right in (("1\n2", "12"), ("1.5", "1 5"), ("R₁", "R1"), ("x²", "x2"), ("m s", "ms"), ("R-1", "R+1")):
            with self.subTest(left=left, right=right):
                self.assertNotEqual(printed_body_tokens(left), printed_body_tokens(right))

    def test_exclusion_requires_owned_diagram_label_and_identical_body(self):
        native = " ".join(("3. 请选出符合原条件的一项。", "电流表和电压表的单位均保持原样。") * 4) + "\nA. 𝑅1\nB. 10Ω"
        box = lambda a, b, c, d: ((a, b), (c, b), (c, d), (a, d))
        body = native.splitlines()
        polygons = [box(5, 20 * i + 5, 40, 20 * i + 12) for i in range(len(body))]
        image = [(50, 5, 100, 70)]
        native_boxes = [(5, 5, 40, 12), (5, 25, 40, 32), (5, 45, 40, 52)]
        bitmap = SimpleNamespace(get_posconv=lambda _page: SimpleNamespace(to_page=lambda x, y: (x, y)))

        def matches(extra="R₃", extra_box=box(60, 20, 70, 30), text=body, bounds=native_boxes):
            receipt = SimpleNamespace(txts=[text[0], extra, *text[1:]], boxes=[polygons[0], extra_box, *polygons[1:]])
            return matches_printed_body(native, bounds, image, bitmap, None, receipt)

        self.assertTrue(matches())
        self.assertFalse(matches(extra_box=box(42, 20, 53, 30)))
        self.assertFalse(matches(bounds=native_boxes + [(62, 22, 67, 28)]))
        self.assertFalse(matches(extra="D. R3"))
        self.assertFalse(matches(extra="13"))
        self.assertFalse(matches(extra="单位"))
        self.assertFalse(matches(text=[body[0], "A. R1", "B. 1 Ω"]))
        self.assertFalse(matches(text=[body[0], "B. 10Ω", "A. R1"]))
        self.assertFalse(matches(text=[body[0], "A. R₁", "B. 10Ω"]))


if __name__ == "__main__":
    unittest.main()
