#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUT_FILE="$ROOT_DIR/release.zip"

cd "$ROOT_DIR"

python3 - "$OUT_FILE" <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys

out_file = Path(sys.argv[1])
root = out_file.parent

entries = [
    "manifest.json",
    "content.js",
    "content.css",
    "navigation-logic.js",
    "localization.js",
    "popup.html",
    "popup.js",
    "popup-logic.js",
    "README.md",
    "icons",
    "_locales",
]

with ZipFile(out_file, "w", compression=ZIP_DEFLATED) as zf:
    for entry in entries:
        path = root / entry
        if path.is_dir():
            zf.writestr(f"{entry.rstrip('/')}/", "")
            for dir_path in sorted(
                p for p in path.rglob("*")
                if p.is_dir() and not any(part.startswith(".") for part in p.relative_to(root).parts)
            ):
                zf.writestr(f"{dir_path.relative_to(root).as_posix().rstrip('/')}/", "")
            for file_path in sorted(path.rglob("*")):
                if file_path.is_file() and not any(part.startswith(".") for part in file_path.relative_to(root).parts):
                    zf.write(file_path, file_path.relative_to(root).as_posix())
        else:
            if not any(part.startswith(".") for part in path.relative_to(root).parts):
                zf.write(path, entry)

print(f"Built {out_file}")
PY
