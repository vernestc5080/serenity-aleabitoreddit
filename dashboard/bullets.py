"""Read wrapped Markdown bullets from the project's research notes."""

from __future__ import annotations

import re


def collect_bullets(lines: list[str]) -> dict[str, str]:
    bullets = {}
    active = None
    for line in lines:
        match = re.match(r"^-\s+\*\*([^*:]+):?\*\*:?[ \t]*(.*)", line)
        if match:
            active = match.group(1).lower().strip()
            bullets[active] = match.group(2).strip()
        elif active and line.startswith("  ") and line.strip() and not line.lstrip().startswith("- "):
            bullets[active] += " " + line.strip()
        elif line.strip():
            active = None
    return bullets
