#!/usr/bin/env python3
"""Fail closed when deployable public files contain private-material markers."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN_ROOTS = (ROOT / "index.html", ROOT / "README.md", ROOT / "assets", ROOT / "data")
FORBIDDEN = (
    "/data_storage/",
    "/Users/",
    "BEGIN OPENSSH PRIVATE KEY",
    "BEGIN PRIVATE KEY",
    "dataset_bindings.json",
    "solution/solve",
    "tests/test",
    "patient_id",
    "subject_id",
)


def files():
    for item in SCAN_ROOTS:
        if item.is_file():
            yield item
        elif item.is_dir():
            yield from (path for path in item.rglob("*") if path.is_file())


hits = []
for path in files():
    text = path.read_text(errors="replace")
    for marker in FORBIDDEN:
        if marker in text:
            hits.append(f"{path.relative_to(ROOT)}: {marker}")
if hits:
    raise SystemExit("Potential private material found:\n" + "\n".join(hits))
print("public boundary scan passed")
