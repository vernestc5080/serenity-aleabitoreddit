"""Taiwan ticker resolution and archive matching for the local dashboard."""

from __future__ import annotations

import re
from bullets import collect_bullets


TAIWAN_INPUT = re.compile(r"^(?:([0-9]{4,6})(?:\.(TW|TWO|5W))?|(?:(TWSE|TW|TPEX|TWO|OTC):([0-9]{4,6})))$", re.I)
KNOWN_ALIASES = {
    "2330": ("TSM", "TSMC", "TAIWAN SEMICONDUCTOR"),
    "3105": ("WIN SEMI", "WIN SEMICONDUCTORS", "3105"),
    "3231": ("WISTRON", "3231"),
    "3363": ("FOCI", "3363"),
    "6451": ("SHUNSIN", "6451"),
    "6789": ("VISERA", "6789"),
    "2308": ("DELTA 2308", "2308"),
}


def parse_input(value: str):
    hit = TAIWAN_INPUT.fullmatch(value.strip().upper())
    if not hit:
        return None
    code = hit.group(1) or hit.group(4)
    suffix = hit.group(2)
    prefix = hit.group(3)
    if prefix:
        suffix = "TW" if prefix in {"TWSE", "TW"} else "TWO"
    if suffix == "5W":
        suffix = "TW"
    return code, suffix


def quote_candidates(code: str, suffix: str | None):
    return [f"{code}.{suffix}"] if suffix else [f"{code}.TW", f"{code}.TWO"]


def clean(value: str):
    value = re.sub(r"\[([^]]+)\]\(https?://[^)]+\)", r"\1", value)
    return re.sub(r"\s+", " ", re.sub(r"[*`#]", "", value)).strip(" -:;")


def section_for_code(code: str, lines: list[str], thesis_section):
    if code == "2330":
        return thesis_section("TSM", lines)
    header_pattern = re.compile(r"^#{2,3}\s+.*(?<!\d)" + re.escape(code) + r"(?!\d)")
    for start, line in enumerate(lines):
        if not header_pattern.match(line):
            continue
        level = len(line) - len(line.lstrip("#"))
        body = []
        for next_line in lines[start + 1:]:
            next_level = len(next_line) - len(next_line.lstrip("#"))
            if next_level and next_line.startswith("#") and next_level <= level:
                break
            body.append(next_line)
        bullets = collect_bullets(body)
        signal = bullets.get("latest signal") or bullets.get("latest stance") or bullets.get("thesis") or ""
        context = bullets.get("context") or ""
        # A project entry labels Wistron as TWO:3231, but the quote resolves to TWSE.
        if code == "3231":
            context = ""
        return {"heading": clean(line.lstrip("# ")), "signal": clean(signal)[:560], "context": clean(context)[:500]}
    return None


def post_matches(text: str, code: str, aliases: tuple[str, ...]):
    upper = text.upper()
    for alias in aliases:
        if re.search(r"(?<![A-Z0-9])" + re.escape(alias) + r"(?![A-Z0-9])", upper):
            return True
    return bool(re.search(r"(?:\$|\bTWSE:|\bTPEX:|\bTWO:|\bTW:|\bOTC:)" + re.escape(code) + r"(?:\.(?:TW|TWO))?\b", upper)
                or re.search(r"\b" + re.escape(code) + r"\.(?:TW|TWO)\b", upper))


def matching_posts(code: str, index: dict):
    aliases = KNOWN_ALIASES.get(code, ())
    results = []
    for post in index["all_posts"]:
        if post.get("isRetweet"):
            continue
        if post_matches(post.get("text") or "", code, aliases):
            results.append(post)
    results.sort(key=lambda post: post.get("createdAtISO") or "", reverse=True)
    return results


def theme_for_taiwan(code: str, thesis: dict | None, posts: list[dict], theme_for):
    if code in {"3105", "3363", "6451", "6789"}:
        return ("TAIWAN / PHOTONICS", "Which optical component or foundry step is scarce?", "Verify customer qualification, actual orders, capacity, realized margins, and currency risk.", (0.25, 0.15, 0.25, 0.55))
    if code == "3231":
        return ("TAIWAN / AI SERVERS", "Can AI-server demand and subsidiary value convert into shareholder returns?", "Verify consolidated revenue, subsidiary value, margins, governance, and currency risk.", (0.22, 0.12, 0.25, 0.50))
    if code == "2330":
        return ("TAIWAN / FOUNDRY", "Can advanced-node and packaging demand sustain pricing power?", "Verify utilization, capital spending, geopolitical exposure, and currency risk.", (0.18, 0.10, 0.20, 0.40))
    return theme_for(code, thesis, posts)


def analyze_taiwan(value: str, index: dict, quote_for, thesis_section, theme_for):
    code, suffix = parse_input(value)
    quote = None
    resolved = f"{code}.{suffix}" if suffix else code
    for candidate in quote_candidates(code, suffix):
        try:
            candidate_quote = quote_for(candidate)
            if candidate_quote.get("currency") == "TWD":
                quote, resolved = candidate_quote, candidate
                break
        except Exception:
            continue
    posts = matching_posts(code, index)
    thesis = section_for_code(code, index["lines"], thesis_section)
    category, question, risk, bands = theme_for_taiwan(code, thesis, posts, theme_for)
    coverage = "thesis" if thesis else "mentions" if posts else "none"
    recent = []
    for post in posts[:3]:
        post_id = str(post.get("id") or "")
        recent.append({
            "date": (post.get("createdAtISO") or "")[:10],
            "text": re.sub(r"\s+", " ", post.get("text") or "").strip()[:320],
            "url": "https://x.com/aleabitoreddit/status/" + post_id if post_id.isdigit() else None,
        })
    ranges = None
    if quote:
        price = quote["price"]
        ranges = {
            "buy": [round(price * (1 - bands[0]), 2), round(price * (1 - bands[1]), 2)],
            "sell": [round(price * (1 + bands[2]), 2), round(price * (1 + bands[3]), 2)],
            "method": "Mechanical TWD category bands around the Yahoo quote; not a valuation or Serenity price target.",
        }
    recommendations = {
        "2330": {
            "case": "Advanced-node demand, CoWoS packaging, and leading-edge utilization must convert into sustained revenue growth and pricing power.",
            "patience": "Watch for capex overruns, geopolitics, customer insourcing, or utilization falling before the next node ramp pays back.",
            "note": "Verify monthly revenue, 2nm/3nm and advanced-packaging capacity, capex discipline, gross margin, and geopolitical exposure."
        },
        "2454": {
            "case": "MediaTek must turn AI ASIC, edge-AI, connectivity, and premium smartphone design wins into recurring revenue and margin expansion.",
            "patience": "The thesis weakens if AI ASIC customers do not move from design wins to volume, handset demand slips, or competition compresses pricing.",
            "note": "Verify named customer ramps, ASIC backlog, smartphone mix, R&D spending, gross margin, and quarterly revenue conversion."
        },
        "3105": {
            "case": "Win Semi must convert qualified InP and laser demand into volume wafers, pricing power, and recurring foundry revenue.",
            "patience": "Watch qualification delays, customer concentration, capex funding, yield, and whether the laser bottleneck appears in reported margins.",
            "note": "Verify Sivers and other customer qualification, InP capacity, wafer shipments, ASPs, gross margin, and cash runway."
        },
        "3231": {
            "case": "Wistron must grow AI-server revenue while the value of its Wiwynn stake remains visible through earnings and the parent-company discount narrows.",
            "patience": "The thesis weakens if AI-server demand slows, subsidiary value fails to reach shareholders, margins deteriorate, or governance and currency risks rise.",
            "note": "Verify consolidated AI-server revenue, Wiwynn ownership value, operating margin, cash flows, related-party governance, and TWD exposure."
        }
    }.get(code, {
        "case": "The company must show a real Taiwan supply-chain constraint, qualified customers, and a path from capacity or design wins to recurring revenue.",
        "patience": "Do not promote the idea until customer qualification, alternatives, margins, funding needs, and revenue timing are visible in filings or earnings.",
        "note": "Run the project checklist: map the bottleneck, identify substitutes, verify signed demand, compare GAAP margins, and check dilution and cash runway."
    })
    label = ", ".join(KNOWN_ALIASES.get(code, ())) or "numeric Taiwan ticker references"
    return {
        "symbol": resolved,
        "coverage": coverage,
        "category": category,
        "thesis": thesis,
        "bottleneckQuestion": question,
        "riskChecks": risk,
        "mentionCount": len(posts),
        "latestMention": recent[0]["date"] if recent else None,
        "posts": recent,
        "quote": quote,
        "quoteError": None if quote else "Taiwan quote unavailable; verify the code and exchange suffix.",
        "ranges": ranges,
        "archiveUpdatedThrough": index["latest"],
        "archiveMatch": f"Related archive terms: {label}. Company matches may include broader thematic discussion.",
        "recommendation": recommendations,
        "exchange": "TWSE" if resolved.endswith(".TW") else "TPEx" if resolved.endswith(".TWO") else "Taiwan exchange unresolved",
    }
